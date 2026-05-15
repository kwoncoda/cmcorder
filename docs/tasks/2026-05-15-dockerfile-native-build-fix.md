# 2026-05-15 — Dockerfile 네이티브 모듈 빌드 실패 수정

## 목표

`docker compose up -d --build` 시 `better-sqlite3` 네이티브 모듈 빌드가 실패하면서 전체 도커 빌드가 중단되는 문제 해결. D-1 리허설(5/19)을 코앞에 두고 운영 컨테이너가 안 올라가는 상태였음.

## 만든 것

- `Dockerfile` 수정 — `frontend-build`, `prod-deps` 두 단계에 `apk add --no-cache python3 make g++` 추가.

## 한 일

### 원인

`docker compose up -d --build` 로그 발췌:

```
prebuild-install warn install No prebuilt binaries found (target=20.20.2 runtime=node arch=x64 libc=musl platform=linux)
gyp ERR! find Python Python is not set ...
Error: Could not find any Python installation to use
```

- `better-sqlite3@12.10.0`은 C++ 네이티브 모듈 → 설치 시 OS별 컴파일된 `.node` 바이너리 필요.
- `node:20-alpine` 베이스 이미지는 매번 최신 20.x 패치(`20.20.2`)를 받는데, 이 조합(musl + 20.20.2)에 맞는 prebuild가 푸시되지 않아 npm이 source 빌드로 fallback.
- Alpine은 용량 절약 베이스라 Python·gcc·make가 빠져 있어 `node-gyp`가 Python을 못 찾고 실패.

### 수정

`Dockerfile`의 두 단계에 빌드 도구 설치 추가 (`WORKDIR /app` 직후, `COPY package.json` 앞):

```dockerfile
RUN apk add --no-cache python3 make g++
```

대상:

- 1단계 `frontend-build` — `npm ci --include=dev` 에서 better-sqlite3 컴파일.
- 2단계 `prod-deps` — `npm ci --omit=dev` 에서도 동일.

3단계(런타임)는 `COPY --from=prod-deps /app/node_modules` 만 받아오므로 빌드 도구가 따라가지 않음 → 최종 이미지 사이즈에는 영향 없음.

## 테스트 결과

### 도커 빌드

```
docker compose up -d --build
...
#10 [app frontend-build  5/10] RUN npm ci --include=dev   DONE 85.8s
#11 [app prod-deps 5/5] RUN npm ci --omit=dev              DONE 87.4s
#16 [app frontend-build 10/10] RUN npm run build           DONE 4.4s
   ✓ 1897 modules transformed.
   dist/index.html ... 0.42 kB
   dist/assets/index-C3NmtbqD.js 292.51 kB │ gzip: 90.66 kB
   ✓ built in 3.61s
#21 [app] exporting to image                              DONE 0.5s
Container chickenedak  Started
```

빌드 성공, 컨테이너 기동 완료.

### 헬스 체크

```
$ docker compose ps
NAME          STATUS                    PORTS
chickenedak   Up 11 seconds (healthy)   0.0.0.0:3000->3000/tcp

$ curl -sS http://localhost:3000/healthz
{"ok":true}
```

컨테이너 healthy 상태 진입, `/healthz` 정상 응답.

## 영향 범위

- 도커 빌드 시간이 약 17초 늘어남 (apk 패키지 47개 설치). 운영 영향 없음 — 빌드 단계에서만.
- 최종 런타임 이미지 크기 변화 없음 (런타임 단계는 그대로).

## 다음에 할 것

- D-1 리허설(5/19) 시 `docker compose up -d --build` 절차 실거동 점검.
- `docs/operations/d1-rehearsal.md` 도커 섹션에 "빌드 첫 1회는 약 3분 소요" 메모 추가 검토 (필요 시).

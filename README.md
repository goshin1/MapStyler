# MapStyler

시도를 선택하면 해당 시도의 시군구별 **울림율**을 3D 블록으로 보여주는 지도 화면 (Vue 3 + MapLibre GL).

- 0~99.9%: 값에 비례한 낮은 높이, 메인 색을 연하게 + 반투명
- 100%: 한 단계 더 높게, 메인 색 원색 + 글로우 / 1곳이면 말풍선, 여러 곳이면 요약 박스
- 우측 리모컨(`H` 키로 접기)에서 시도·색·높이·애니메이션·값 조정

## 개발

```bash
npm install
npm run dev
```

- 배경 지도 파일(`public/tiles/korea.pmtiles`)이 아직 없으면 `.env.local`에
  `VITE_BASEMAP_URL=https://tiles.openfreemap.org/planet` 을 넣고 개발 (`.env.example` 참고)
- 시군구 경계 데이터를 다시 만들 때: `npm run build:geo` (`data/geojson-raw` → `public/geo`)

## 서버 값 형식

```json
{ "서울특별시 종로구": 72.4, "경기도 수원시": 100 }
```

- 이름은 공백 무시, 예전 시도명은 별칭 처리 (`src/config/sido.ts`의 `SIDO_ALIAS`)
- 일반구가 있는 시는 시 단위 (수원시, 성남시, 창원시 등 13개)
- 100% 판정은 반올림 전 값 `>= 100`

## 배경 지도 파일 (`public/tiles/korea.pmtiles`)

대한민국 전역, 줌 0~12, 약 45MB. git에 포함되어 있어 clone만 하면 바로 동작한다.
(시도 단위 화면은 줌 11 전후라 12까지면 충분하고, 그 이상 확대해도 벡터라 선이 깨지지 않는다)

지도를 갱신할 때만 다시 만든다 (인터넷 되는 PC, Docker, PowerShell):

```powershell
mkdir data\tiles
docker run --rm -e JAVA_TOOL_OPTIONS="-Xmx4g" -v ${PWD}\data\tiles:/data ghcr.io/onthegomap/planetiler:latest `
  --download --area=south-korea --maxzoom=12 --output=/data/korea.pmtiles `
  --exclude-layers=poi,housenumber,transportation_name,water_name,place,mountain_peak,aerodrome_label
copy data\tiles\korea.pmtiles public\tiles\korea.pmtiles
```

- `data/tiles`(원본 다운로드 캐시, 약 1.6GB)는 git 제외
- GitHub는 100MB 넘는 파일을 거부하므로 `--maxzoom`은 12 이하 유지
- 지도 데이터 출처: © OpenStreetMap contributors, © OpenMapTiles

## 배포 (인터넷 없는 환경)

```bash
npm run build      # dist/ 생성 (public/tiles/korea.pmtiles 포함)
```

- `dist/` 를 사용 PC의 웹 서버(Nginx, IIS 등)에 올린다. 외부 요청은 없다.
- PMTiles는 **HTTP Range 요청**을 쓰므로 `index.html` 을 파일로 직접 열면 배경 지도가 나오지 않는다.
  간단히 확인할 때는 `npm run preview`.
- 라벨은 PC에 설치된 한글 폰트(맑은 고딕 등)로 그린다.

import { addProtocol } from 'maplibre-gl'
import { Protocol } from 'pmtiles'

/**
 * pmtiles:// 프로토콜 등록.
 * 배경 지도를 타일 서버 없이 정적 파일 하나(korea.pmtiles)에서 HTTP Range 요청으로 읽는다.
 */
const protocol = new Protocol({ metadata: true })
addProtocol('pmtiles', protocol.tile)

// ============================================================================
// 대시보드 버전 전환 스위치 (1줄 변경):
// - V1 (기본 원본):                     import DashboardPage from './pages/DashboardPage';
// - V2 (에디토리얼 피드):                import DashboardPage from './pages/DashboardPageV2';
// - V3 (소식 검색·페이지네이션·계정찾기): import DashboardPage from './pages/DashboardPageV3';
// - V4 (감성 필터 칩 + 라이트/다크 모드): import DashboardPage from './pages/DashboardPageV4';
// - V5 (다크모드 백화 수정·필터 정리):     import DashboardPage from './pages/DashboardPageV5';
// - V6 (레이아웃 전면 개선·홈 통합 툴바):  import DashboardPage from './pages/DashboardPageV6';
// - V7 (최신 디자인 + 실제 API 연결, 가짜 데이터 없음): import DashboardPage from './pages/DashboardPageV7';
//   V2~V5 는 비교용 옛 화면이라 가짜 데이터(mocks/mockData.js)를 씀. V6·V7 은 실제 API만 씀 (api/README.md)
// ============================================================================
import DashboardPage from './pages/DashboardPageV8';

export default function App() {
  return <DashboardPage />;
}

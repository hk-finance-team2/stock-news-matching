// ============================================================================
// 대시보드 버전 전환 스위치 (1줄 변경):
// - V1 (기본 원본):                     import DashboardPage from './pages/DashboardPage';
// - V2 (에디토리얼 피드):                import DashboardPage from './pages/DashboardPageV2';
// - V3 (소식 검색·페이지네이션·계정찾기): import DashboardPage from './pages/DashboardPageV3';
// - V4 (감성 필터 칩 + 라이트/다크 모드): import DashboardPage from './pages/DashboardPageV4';
// ============================================================================
import DashboardPage from './pages/DashboardPageV4';

export default function App() {
  return <DashboardPage />;
}

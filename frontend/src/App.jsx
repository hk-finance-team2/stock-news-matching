// ============================================================================
// 시안 전환 스위치:
// - 원본 화면:    import DashboardPage from './pages/DashboardPage';
// - 시안 V2 (피드): import DashboardPage from './pages/DashboardPageV2';
// - 시안 V3 (검색·페이지네이션·계정찾기): import DashboardPage from './pages/DashboardPageV3';
// ============================================================================
import DashboardPage from './pages/DashboardPageV3';

export default function App() {
  return <DashboardPage />;
}

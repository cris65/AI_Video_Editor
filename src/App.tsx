
import { PancakeDashboard } from './components/dashboard/PancakeDashboard';

export default function App() {
  // Hardcoded per la Fase 2 HITL
  const sequenceName = "RAW_BASE_SEQ_AMICI_DONDOLO";

  return (
    <PancakeDashboard sequenceName={sequenceName} />
  );
}

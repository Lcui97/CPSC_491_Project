import { Link } from 'react-router-dom';
import ClassAssistantChat from '../components/assistant/ClassAssistantChat';

export default function AssistantPage() {
  return (
    <div className="assistant-page">
      <header className="assistant-topbar">
        <Link to="/home" className="assistant-back">
          ← Back to home
        </Link>
      </header>
      <ClassAssistantChat />
    </div>
  );
}

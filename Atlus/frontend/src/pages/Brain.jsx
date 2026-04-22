import { Link } from 'react-router-dom';

export default function Brain() {
  return (
    <div className="page-min">
      <div className="page-narrow">
        <h1 className="page-title">Classes</h1>
        <p className="text-muted" style={{ marginTop: '0.5rem' }}>Open a class from the home sidebar to work with notes and scans.</p>
        <Link to="/home" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
          Back to Home
        </Link>
      </div>
    </div>
  );
}

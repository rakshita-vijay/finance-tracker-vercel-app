import Link from "next/link";

export default function MainMenuPage() {
  return (
    <div>
      <h1>💸 Finance Tracker</h1>
      <p>Navigate using the sidebar to manage your finances, analyze trends, and generate reports.</p>
      <div className="divider" />
      <div className="card">
        <Link href="/transactions">➕ Add Transactions</Link>
      </div>
      <div className="card">
        <Link href="/spending">📊 View Spending</Link>
      </div>
      <div className="card">
        <Link href="/reports">📝 Generate Report</Link>
      </div>
      <div className="card">
        <Link href="/budget">💰 Change Budget</Link>
      </div>
      <div className="card">
        <Link href="/downloads">⬇️ Download Files</Link>
      </div>
      <div className="card">
        <Link href="/wipe">🗑️ Wipe Transactions</Link>
      </div>
      <div className="card">
        <Link href="/settings">⚙️ Account Settings</Link>
      </div>
    </div>
  );
}

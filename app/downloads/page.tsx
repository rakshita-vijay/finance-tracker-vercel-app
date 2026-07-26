export default function DownloadFilesPage() {
  return (
    <div>
      <h1>⬇️ Download Files</h1>
      <div className="divider" />
      <div className="card">
        <a href="/api/download/csv"><button>Download CSV (Transactions)</button></a>
      </div>
      <div className="card">
        <a href="/api/download/txt"><button>Download TXT (ASCII Table)</button></a>
      </div>
      <div className="card">
        <a href="/api/download/pdf"><button>Download PDF (Report)</button></a>
      </div>
      <div className="card">
        <a href="/reports"><button>Download MD (from Report History)</button></a>
      </div>
      <div className="card">
        <a href="/api/download/zip"><button>Download All Files (ZIP)</button></a>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { websiteApi } from '../lib/websiteApi';
import { Heart, Loader2, RefreshCw } from 'lucide-react';

interface GensAccessRow {
  userId: string;
  name: string;
  email: string;
  status: string;
  firstAccessedAt: string;
  lastAccessedAt: string;
  accessCount: number;
}

export default function GensAccess() {
  const [rows, setRows] = useState<GensAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await websiteApi.getGensAccess();
      setRows((data as any).users || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-pink-500 to-red-500">
              <Heart className="w-3.5 h-3.5 text-white" fill="currentColor" />
            </span>
            Gens Access
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Every user who has entered the 18+ Gens (mature/romance) section, and how often.
          </p>
        </div>
        <button type="button" onClick={load} className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold self-start sm:self-auto">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden glass-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-faint)' }}>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">First Access</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Last Access</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Visits</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-3 text-white whitespace-nowrap">{row.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{row.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                        style={{
                          background: row.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: row.status === 'active' ? '#4ade80' : '#f87171',
                        }}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {new Date(row.firstAccessedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {new Date(row.lastAccessedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-bold" style={{ color: 'var(--accent-text)' }}>{row.accessCount}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                      No one has accessed Gens yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

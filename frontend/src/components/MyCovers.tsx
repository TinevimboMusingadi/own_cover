import React, { useEffect, useState } from 'react';
import { Disc, Download, Play, Trash2, Loader2, Library, Plus } from 'lucide-react';
import { SavedCover } from '../types';
import { deleteCover, listCovers } from '../firebase';
import { formatTime } from '../api';

interface MyCoversProps {
  userKey: string;
  onPlay: (cover: SavedCover) => void;
  onNewCover: () => void;
}

export const MyCovers: React.FC<MyCoversProps> = ({ userKey, onPlay, onNewCover }) => {
  const [covers, setCovers] = useState<SavedCover[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    listCovers()
      .then(setCovers)
      .finally(() => setIsLoading(false));
  }, [userKey]);

  const remove = async (id: string) => {
    if (!confirm('Remove this cover from your library?')) return;
    await deleteCover(id);
    setCovers((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-studio-yellow mb-1">Library</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Syne']">My Covers</h2>
          <p className="text-sm text-studio-muted mt-1">Every cover you've made, ready to replay or download.</p>
        </div>
        <button onClick={onNewCover} className="px-5 py-3 rounded-xl bg-yellow-gradient text-studio-dark font-bold text-xs uppercase tracking-wider flex items-center gap-2 yellow-glow self-start">
          <Plus className="w-4 h-4" /> New cover
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-studio-muted text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading your library…</div>
      ) : covers.length === 0 ? (
        <div className="rounded-3xl studio-glass py-16 text-center">
          <Library className="w-10 h-10 mx-auto text-studio-border mb-3" />
          <p className="text-sm text-studio-muted">No covers yet. Make your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {covers.map((c) => (
            <article key={c.id} className="rounded-2xl bg-studio-card border border-studio-border p-3 flex gap-3 studio-glass-hover">
              <button onClick={() => onPlay(c)} className="relative w-20 h-20 rounded-xl overflow-hidden bg-studio-vinyl shrink-0 group" title="Play">
                {c.artwork ? <img src={c.artwork} alt="" className="w-full h-full object-cover" /> : <Disc className="w-full h-full p-5 text-studio-yellow" />}
                <span className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-6 h-6 text-white" />
                </span>
              </button>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-white truncate">{c.title}</h3>
                <p className="text-xs text-studio-muted truncate">{c.artist}</p>
                <p className="text-[10px] text-studio-yellow font-mono truncate mt-1">
                  {c.voice_name} · {formatTime(c.duration)}
                  {c.created_at && ` · ${new Date(c.created_at * 1000).toLocaleDateString()}`}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <a href={c.master_url} download className="p-1.5 rounded-lg hover:bg-studio-border text-studio-muted hover:text-white" title="Download MP3"><Download className="w-4 h-4" /></a>
                  <button onClick={() => remove(c.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-studio-muted hover:text-red-400" title="Remove"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

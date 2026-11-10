import {useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';

declare function exportYaprakNotebook(): Promise<Blob>;
declare function importYaprakNotebook(file: Blob): Promise<number>;
type Backup = {id: number, savedAt: string};

function BackupPanel() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState(localStorage.getItem('backup-server') || '');
  const [token, setToken] = useState('');
  const [list, setList] = useState<Backup[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function request(path = '', body?: FormData) {
    const base = new URL(url);
    if (base.protocol !== 'https:' && !(base.protocol === 'http:' && base.hostname === 'localhost')) {
      throw Error('Sunucu için HTTPS adresi gir.');
    }
    if (!token.trim()) throw Error('Kişisel sunucu anahtarını gir.');
    const response = await fetch(new URL('/api/backups' + path, base), {
      method: body ? 'POST' : 'GET', body, headers: {Authorization: 'Bearer ' + token.trim()},
      credentials:'omit', redirect:'error', cache:'no-store'
    });
    if (!response.ok) throw Error(response.status === 401 ? 'Sunucu anahtarı geçersiz.' : 'Sunucu yanıtı: ' + response.status);
    localStorage.setItem('backup-server', base.origin);
    return response;
  }
  async function run(action: () => Promise<string>) {
    setBusy(true);
    setMessage('');
    try { setMessage(await action()); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'İşlem tamamlanamadı.'); }
    finally { setBusy(false); }
  }
  async function restore(file: Blob) {
    return (await importYaprakNotebook(file)) + ' yeni sayfa eklendi. Mevcut sayfalar korundu.';
  }
  return <>
    <button onClick={() => dialog.current?.showModal()}>Defter yedeği</button>
    <dialog className="menu" ref={dialog} onClose={() => {setToken('');setList([]);}}>
      <div className="row"><h2>Defter yedeği</h2><button aria-label="Kapat" onClick={() => dialog.current?.close()}>✕</button></div>
      <p>Metin, görsel ve seslerin birlikte yedeklenir. İçe aktarırken yalnızca eksik sayfalar eklenir.</p>
      <fieldset disabled={busy}>
        <button onClick={() => run(async () => {
          const archive = new File([await exportYaprakNotebook()], 'yaprak-defter.json', {type:'application/json'});
          if (navigator.canShare?.({files:[archive]})) {
            await navigator.share({files:[archive]});
          } else {
            const href = URL.createObjectURL(archive);
            const anchor = document.createElement('a');
            anchor.href = href; anchor.download = archive.name; anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(href), 60000);
          }
          return 'Dışa aktarma tamamlandı.';
        })}>Dosyaya aktar</button>
        <label>Dosyadan içe aktar<input type="file" accept=".json,application/json" onChange={e => {
          const file=e.target.files?.[0]; e.target.value=''; if (file) void run(() => restore(file));
        }}/></label>
        <h3>Kişisel sunucu</h3>
        <label>Sunucu adresi<input type="url" value={url} placeholder="https://…" onChange={e => {setList([]);setUrl(e.target.value);}}/></label>
        <label>Erişim anahtarı<input type="password" value={token} autoComplete="off" onChange={e => {setList([]);setToken(e.target.value);}}/></label>
        <div className="tools"><button onClick={() => run(async () => {
          const file = await exportYaprakNotebook();
          if (file.size > 32 * 1024 * 1024) throw Error('Bu sunucuda yedek sınırı 32 MB.');
          const data = new FormData(); data.append('file',file,'yaprak.json');
          await request('',data); setList([]); return 'Yeni yedek sunucuya kaydedildi.';
        })}>Yeni yedek al</button>
        <button onClick={() => run(async () => {
          const backups: Backup[] = await (await request()).json(); setList(backups);
          return backups.length ? 'İçe aktarılacak yedeği seç.' : 'Henüz yedek yok.';
        })}>Yedekleri göster</button></div>
        {list.map(b => <p key={b.id}><button onClick={() => run(async () => restore(await (await request('/'+b.id)).blob()))}>
          {new Date(b.savedAt).toLocaleString('tr-TR')} · İçe aktar</button></p>)}
      </fieldset>
      <p role="status">{busy ? 'İşleniyor…' : message}</p>
    </dialog>
  </>;
}
createRoot(document.getElementById('backup-controls')!).render(<BackupPanel/>);

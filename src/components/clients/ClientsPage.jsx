import { useEffect, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import PromptTable from '../dashboard/PromptTable'
import Card from '../dashboard/Card'
import { Delta } from '../dashboard/SyncHistory'
import { PrimaryButton, useToast } from '../dashboard/overlays'
import SiteLogo from '../ui/SiteLogo'
import { openDrawer } from '../audit/parts'
import { useDrawer } from '../audit/DrawerShell'
import SyncSheet from './SyncSheet'
import ClientDrawer from './ClientDrawer'
import { SETUP, Spinner, SyncButton, lastSyncText, syncBusy, textBtn, viewAs } from './shared'
import { AddClientModal } from './ClientModals'
import { agency, role } from '../../store/workspace'
import { clientActions, clientsStates, syncModes } from '../../data/mock'

// /clients — the agency's Clients list (agency home; replaces app.kraffic.ai's /agency/dashboard). One row per client:
// logo, name + domain, visibility score + change, last sync, setup; Sync and View as on the row. A row opens the
// client's drawer (?client=): its sync's progress, sign-in email, account, scan switches, Edit / Deactivate / Delete.
// ?mock=loading | empty | scanning | sync-running | sync-background | sync-done | sync-error (data/mock.js clientsStates)
const t2 = 'text-stone-600'
const t3 = 'text-stone-500'

const startState = () => {
  const key = new URLSearchParams(window.location.search).get('mock')
  return structuredClone(clientsStates[key] ?? clientsStates.scanning)
}

export default function ClientsPage() {
  const [s] = useState(startState)
  const [clients, setClients] = useState(s.clients)
  const [syncs, setSyncs] = useState(s.syncs ?? {})
  const [sheet, setSheet] = useState(null) // the client whose Sync now sheet is open
  const [sheeted, setSheeted] = useState(clients[0] ?? { name: '', prompts: 0, missed: 0, brands: 1 }) // kept while the sheet closes
  useEffect(() => { if (sheet) setSheeted(sheet) }, [sheet])
  const [adding, setAdding] = useState(false)
  const [toastNode, toast] = useToast()
  useEffect(() => { document.title = 'Clients · Kraffic' }, [])
  const drawer = useDrawer('client', (id) => clients.find((c) => c.id === id))
  // a finished sync from the preview says so once
  useEffect(() => { if (s.syncs?.['dermasuri-co']?.status === 'done') toast('Sync finished · Dermasuri Skincare') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const patchSync = (id, patch) => setSyncs((x) => ({ ...x, [id]: patch && { ...x[id], ...patch } }))
  const patchClient = (id, patch) => setClients((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  // Sync: "Sync started" only once the server took it; each engine's progress; finished, or still running in the
  // background when it outlasts the page's wait (not a failure: the scans go on). Sync stays off until it's done.
  const startSync = (c, mode) => {
    setSheet(null)
    if (syncBusy(syncs[c.id])) return
    patchSync(c.id, { status: 'starting', mode, progress: null })
    clientActions.onSync(c, {
      mode,
      onAccepted: () => { patchSync(c.id, { status: 'running' }); toast(`Sync started · ${c.name}`) },
      onProgress: (progress) => patchSync(c.id, { progress }),
    }).then(
      (res) => {
        if (res?.status === 'complete') { patchSync(c.id, { status: 'done', progress: null }); patchClient(c.id, { lastSync: 'now' }); toast(`Sync finished · ${c.name}`) }
        else { patchSync(c.id, { status: 'background' }); toast('Still running in the background. Results appear as each engine finishes.', { duration: 5000 }) }
      },
      () => patchSync(c.id, { status: 'error', progress: null }),
    )
  }
  const retry = (c) => startSync(c, syncs[c.id]?.mode ?? 'full')

  if (role() !== 'agency') {
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-2 pt-24 text-center">
        <h1 className="text-[20px] leading-7 font-semibold text-stone-900">Clients is for agency accounts</h1>
        <p className={`text-[14px] leading-5 ${t2}`}>Open the mock with ?role=agency to see it.</p>
      </div>
    )
  }

  const sortTime = (c) => (c.lastSync === 'now' ? Date.now() : c.lastSync ? Date.parse(c.lastSync) : 0)
  const columns = [
    {
      key: 'name', label: 'Client', mobile: 'primary', skeleton: '55%',
      sort: { value: (c) => c.name.toLowerCase(), first: 'asc' },
      cell: (c) => (
        <span className="flex min-w-0 items-center gap-3">
          <SiteLogo domain={c.domain} name={c.name} className="h-7 w-7 shrink-0 rounded-md" imgPad="p-1" initialClass="text-[11px]" />
          <span className="min-w-0 truncate text-[14px] leading-5">
            <span className="font-medium text-stone-900">{c.name}</span>
            <span className={`ml-2 ${t3}`}>{c.domain}{c.brands > 1 && ` +${c.brands - 1}`}</span>
          </span>
          {!c.active && <span className="inline-flex h-5 shrink-0 items-center rounded bg-tint px-1.5 text-[12px] leading-none font-medium text-stone-600">Inactive</span>}
        </span>
      ),
    },
    {
      key: 'score', label: 'Visibility', width: 130, skeleton: '50%',
      sort: { value: (c) => c.score ?? -1, first: 'desc' },
      mobileText: (c) => (c.score == null ? 'No score yet' : <span className="inline-flex items-baseline gap-1.5">Score {c.score} <Delta d={c.scoreDelta} /></span>),
      cell: (c) => (c.score == null
        ? <span className={`text-[13px] ${t3}`}>No score yet</span>
        : <span className="flex items-baseline gap-2"><span className="text-[14px] font-semibold text-stone-900 tabular-nums">{c.score}</span><Delta d={c.scoreDelta} /></span>),
    },
    {
      key: 'lastSync', label: 'Last sync', width: 210, skeleton: '60%',
      sort: { value: sortTime, first: 'desc' },
      mobileText: (c) => (syncs[c.id]?.status === 'error' ? <span className="text-negative">{lastSyncText(c, syncs[c.id])}</span> : lastSyncText(c, syncs[c.id])),
      cell: (c) => <LastSync c={c} sync={syncs[c.id]} onRetry={() => retry(c)} />,
    },
    {
      key: 'setup', label: 'Setup', width: 150, skeleton: '50%',
      sort: { value: (c) => ['prompts', 'scanning', 'ready'].indexOf(c.setup), first: 'asc' },
      mobileText: (c) => SETUP[c.setup],
      cell: (c) => (
        <span className={`inline-flex items-center gap-1.5 text-[13px] leading-[18px] ${c.setup === 'ready' ? 'text-stone-900' : t2}`}>
          {c.setup === 'scanning' && <Spinner size={13} />}{SETUP[c.setup]}
        </span>
      ),
    },
    {
      key: 'actions', label: '', width: 196, align: 'right', mobile: false, stopRowClick: true, skeleton: '70%',
      cell: (c) => (
        <span className="flex items-center justify-end gap-4">
          <SyncButton c={c} sync={syncs[c.id]} onClick={() => setSheet(c)} />
          <button type="button" onClick={() => viewAs(c)} className={textBtn}>View as</button>
        </span>
      ),
    },
  ]

  const empty = !s.loading && clients.length === 0
  return (
    <div className="flex w-full flex-col gap-4 pt-2">
      <div className="mb-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-7 font-semibold text-stone-900 lg:text-[28px] lg:leading-9">Clients</h1>
          <p className={`mt-1 text-[13px] leading-[18px] ${t2} md:text-[14px] md:leading-5`}>Every client account in {agency.name}</p>
        </div>
        {!empty && <span className="md:pt-1 max-md:[&>button]:w-full max-md:[&>button]:justify-center"><PrimaryButton size="sm" icon={Plus} onClick={() => setAdding(true)}>Add client</PrimaryButton></span>}
      </div>

      {empty ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-tint text-stone-600" aria-hidden><Users size={18} /></span>
          <div>
            <h2 className="text-[15px] leading-5 font-semibold text-stone-900">No clients yet</h2>
            <p className={`mt-1 text-[13px] leading-[18px] ${t2}`}>Add a client, then set up their brand to start tracking AI answers.</p>
          </div>
          <PrimaryButton size="sm" icon={Plus} onClick={() => setAdding(true)}>Add client</PrimaryButton>
        </Card>
      ) : (
        <PromptTable
          id="clients"
          rows={clients}
          columns={columns}
          filterKeys={['name', 'domain']}
          loading={Boolean(s.loading)}
          rowHeight="h-14"
          pageSizes={[10, 20, 50, 100]}
          defaultSort={{ key: 'name', dir: 'asc' }}
          searchLabel="Search clients"
          emptyQuery={(q) => <>No clients match “{q}”</>}
          onRowClick={(c) => openDrawer('client', c.id)}
          toolbar={({ search, sortButton }) => <div className="flex items-center gap-2">{search}{sortButton}</div>}
        />
      )}

      <ClientDrawer drawer={drawer} sync={drawer.item ? syncs[drawer.item.id] : null} toast={toast}
        onSync={(c) => setSheet(c)} onRetry={retry} onPatch={patchClient}
        onDelete={(c) => { setClients((cs) => cs.filter((x) => x.id !== c.id)); drawer.close() }} />
      <SyncSheet open={Boolean(sheet)} onClose={() => setSheet(null)} name={sheeted.name} modes={syncModes.website}
        counts={{ prompts: sheeted.prompts, missed: sheeted.missed, domains: sheeted.brands, aiMode: sheeted.aiMode }}
        onStart={(mode) => startSync(sheeted, mode)} />
      <AddClientModal open={adding} onClose={() => setAdding(false)} toast={toast}
        onAssigned={(c) => setClients((cs) => [...cs, c])} />
      {toastNode}
    </div>
  )
}

function LastSync({ c, sync, onRetry }) {
  const text = lastSyncText(c, sync)
  if (sync?.status === 'error') {
    return (
      <span className="inline-flex items-center gap-2 text-[13px] leading-[18px]">
        <span className="text-negative">{text}</span>
        <button type="button" data-stop-row onClick={(e) => { e.stopPropagation(); onRetry() }} className="rounded font-medium text-stone-900 underline underline-offset-4 outline-none hover:opacity-75 focus-visible:ring-2 focus-visible:ring-focus">Retry</button>
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] leading-[18px] tabular-nums ${syncBusy(sync) || c.lastSync ? 'text-stone-900' : t3}`}>
      {syncBusy(sync) && <Spinner size={13} />}{text}
    </span>
  )
}

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, Empty, Field, Head, Modal } from '../../components/ui'
import { exec, useCapacidade, useConfig, usePlataformas } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { brl, parseNum, pct } from '../../lib/format'
import type { Plataforma } from '../../lib/types'

export function Custos() {
  const config = useConfig()
  const cap = useCapacidade()
  const plats = usePlataformas()
  const [geral, setGeral] = useState(false)
  const [edit, setEdit] = useState<Plataforma | null>(null)
  const qc = useQueryClient()
  const c = config.data
  return (
    <>
      <Head title="Custos e taxas" sub="Taxas das plataformas mudam com frequência: confirme na Central do Vendedor">
        <button className="btn pri" onClick={() => setGeral(true)}>Editar custos gerais</button>
      </Head>
      {!c || !cap.data ? <Empty>Carregando…</Empty> : (
        <div className="grid kpis">
          <Card className="pad kpi"><div className="l">Filamento (R$/kg)</div><div className="v">{brl(c.filamento_kg)}</div></Card>
          <Card className="pad kpi"><div className="l">Hora de máquina (R$/h)</div><div className="v">{brl(c.maquina_h)}</div></Card>
          <Card className="pad kpi"><div className="l">Seu tempo (R$/h)</div><div className="v">{brl(c.hora_sua)}</div></Card>
          <Card className="pad kpi"><div className="l">Impressoras × horas/dia</div><div className="v">{cap.data.impressoras} × {cap.data.horas_dia}h</div></Card>
        </div>
      )}
      <Card className="clip"><div className="scroll"><table>
        <thead><tr><th>Plataforma</th><th className="right">Margem</th><th className="right">Limite da faixa</th><th className="right">Comissão (baixa / alta)</th><th className="right">Taxa fixa (baixa / alta)</th><th className="right">Imposto</th><th className="right">Pagamento</th><th className="right">Anúncio</th><th /></tr></thead>
        <tbody>{(plats.data ?? []).map((p) => (
          <tr key={p.id}><td className="b">{p.nome}</td><td className="right">{pct(p.margem)}</td><td className="right">{brl(p.lim)}</td>
            <td className="right nowrap">{pct(p.c_low)} / {pct(p.c_high)}</td><td className="right nowrap">{brl(p.f_low)} / {brl(p.f_high)}</td>
            <td className="right">{pct(p.imposto)}</td><td className="right">{pct(p.pag)}</td><td className="right">{brl(p.anuncio)}</td>
            <td className="right"><button className="btn s" onClick={() => setEdit(p)}>Editar</button></td></tr>))}</tbody></table></div></Card>
      <p className="mu sm">O imposto de 6% é exemplo; use o seu (MEI paga valor fixo no mês, então 0%). Ao salvar, os preços sugeridos de todos os produtos são recalculados; pedidos já feitos mantêm o preço da época.</p>

      {geral && c && cap.data && <GeralModal c={c} cap={cap.data} onClose={() => setGeral(false)} onDone={() => { void qc.invalidateQueries({ queryKey: ['config'] }); void qc.invalidateQueries({ queryKey: ['capacidade'] }) }} />}
      {edit && <PlatModal p={edit} onClose={() => setEdit(null)} onDone={() => qc.invalidateQueries({ queryKey: ['plataformas'] })} />}
    </>
  )
}

function GeralModal({ c, cap, onClose, onDone }: { c: { filamento_kg: number; maquina_h: number; hora_sua: number }; cap: { impressoras: number; horas_dia: number }; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ fk: String(c.filamento_kg), mh: String(c.maquina_h), hs: String(c.hora_sua), imp: String(cap.impressoras), hd: String(cap.horas_dia) })
  const F = (k: keyof typeof v, label: string) => <Field label={label}><input className="i" type="number" step="any" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>
  return (
    <Modal title="Custos gerais" wide onClose={onClose} onSave={async () => {
      await exec(supabase.from('config').update({ filamento_kg: parseNum(v.fk), maquina_h: parseNum(v.mh), hora_sua: parseNum(v.hs) }).eq('id', 1))
      await exec(supabase.from('capacidade').update({ impressoras: Math.max(1, Math.round(parseNum(v.imp))), horas_dia: Math.max(1, parseNum(v.hd)) }).eq('id', 1))
      onDone()
    }}>
      <div className="g3">{F('fk', 'Filamento (R$/kg)')}{F('mh', 'Hora de máquina (R$/h)')}{F('hs', 'Seu tempo (R$/h)')}</div>
      <div className="g2">{F('imp', 'Impressoras')}{F('hd', 'Horas úteis por impressora/dia')}</div>
    </Modal>
  )
}

function PlatModal({ p, onClose, onDone }: { p: Plataforma; onClose: () => void; onDone: () => void }) {
  const P = (x: number) => String(Math.round(x * 1000) / 10)
  const [v, setV] = useState({ margem: P(p.margem), lim: String(p.lim), imposto: P(p.imposto), c_low: P(p.c_low), f_low: String(p.f_low), outras: P(p.outras), c_high: P(p.c_high), f_high: String(p.f_high), pag: P(p.pag), anuncio: String(p.anuncio), frete: String(p.frete) })
  const F = (k: keyof typeof v, label: string) => <Field label={label}><input className="i" type="number" step="any" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>
  return (
    <Modal title={p.nome} wide onClose={onClose} onSave={async () => {
      const n = (k: keyof typeof v) => parseNum(v[k]); const pc = (k: keyof typeof v) => parseNum(v[k]) / 100
      await exec(supabase.from('plataformas').update({ margem: pc('margem'), lim: n('lim'), imposto: pc('imposto'), c_low: pc('c_low'), f_low: n('f_low'), outras: pc('outras'), c_high: pc('c_high'), f_high: n('f_high'), pag: pc('pag'), anuncio: n('anuncio'), frete: n('frete') }).eq('id', p.id))
      onDone()
    }}>
      <div className="g3">{F('margem', 'Margem desejada (%)')}{F('lim', 'Limite da faixa (R$)')}{F('imposto', 'Imposto (%)')}</div>
      <div className="g3">{F('c_low', 'Comissão abaixo do limite (%)')}{F('f_low', 'Taxa fixa abaixo (R$)')}{F('outras', 'Outras taxas (%)')}</div>
      <div className="g3">{F('c_high', 'Comissão a partir do limite (%)')}{F('f_high', 'Taxa fixa a partir (R$)')}{F('pag', 'Taxa de pagamento (%)')}</div>
      <div className="g2">{F('anuncio', 'Anúncio por venda (R$)')}{F('frete', 'Frete pago por você (R$)')}</div>
    </Modal>
  )
}

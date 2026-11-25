import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { Layout } from '@/components/Layout'
import { Loading } from '@/components/page'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Login } from '@/pages/Login'
import { Redefinir } from '@/pages/Redefinir'
import { Pendente } from '@/pages/Pendente'
import { Resumo } from '@/pages/comercial/Resumo'
import { Pedidos } from '@/pages/comercial/Pedidos'
import { Produtos } from '@/pages/comercial/Produtos'
import { Custos } from '@/pages/comercial/Custos'
import { Aprovacoes } from '@/pages/comercial/Aprovacoes'
import { Usuarios } from '@/pages/comercial/Usuarios'
import { Fila } from '@/pages/operacional/Fila'
import { Envios } from '@/pages/operacional/Envios'
import { Estoque } from '@/pages/operacional/Estoque'
import { Reposicao } from '@/pages/operacional/Reposicao'

function Gate() {
  const { session, profile, loading } = useAuth()
  if (window.location.pathname === '/redefinir') return <Redefinir />
  if (loading) return <div className="p-10"><Loading /></div>
  if (!session) return <Login />
  if (!profile?.role) return <Pendente />
  return (
    <Routes>
      <Route path="/comercial" element={<Layout area="comercial" />}>
        <Route index element={<Resumo />} />
        <Route path="pedidos" element={<Pedidos />} />
        <Route path="produtos" element={<Produtos />} />
        <Route path="custos" element={<Custos />} />
        <Route path="aprovacoes" element={<Aprovacoes />} />
        <Route path="usuarios" element={<Usuarios />} />
      </Route>
      <Route path="/operacional" element={<Layout area="operacional" />}>
        <Route index element={<Fila />} />
        <Route path="envios" element={<Envios />} />
        <Route path="estoque" element={<Estoque />} />
        <Route path="reposicao" element={<Reposicao />} />
      </Route>
      <Route path="*" element={<Navigate to={profile.role === 'gestao' ? '/comercial' : '/operacional'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <TooltipProvider>
          <Gate />
          <Toaster position="bottom-center" />
        </TooltipProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}

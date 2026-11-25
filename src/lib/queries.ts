import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Capacidade, Config, Filamento, Pedido, Plataforma, Produto, Profile, Reposicao } from './types'

async function run<T>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data as T
}

export const usePedidos = () =>
  useQuery({
    queryKey: ['pedidos'],
    queryFn: () =>
      run<Pedido[]>(
        supabase.from('pedidos').select('*, pedido_itens(*), pedido_financeiro(total, lucro)').order('criado_em', { ascending: false }),
      ),
  })
export const useProdutos = (enabled = true) =>
  useQuery({ queryKey: ['produtos'], enabled, queryFn: () => run<Produto[]>(supabase.from('produtos').select('*').order('nome')) })
export const usePlataformas = (enabled = true) =>
  useQuery({ queryKey: ['plataformas'], enabled, queryFn: () => run<Plataforma[]>(supabase.from('plataformas').select('*').order('ordem')) })
export const useConfig = (enabled = true) =>
  useQuery({ queryKey: ['config'], enabled, queryFn: () => run<Config>(supabase.from('config').select('*').eq('id', 1).single()) })
export const useCapacidade = () =>
  useQuery({ queryKey: ['capacidade'], queryFn: () => run<Capacidade>(supabase.from('capacidade').select('*').eq('id', 1).single()) })
export const useFilamentos = () =>
  useQuery({ queryKey: ['filamentos'], queryFn: () => run<Filamento[]>(supabase.from('filamentos').select('*').eq('ativo', true).order('cor')) })
export const useReposicoes = () =>
  useQuery({
    queryKey: ['reposicoes'],
    queryFn: () => run<Reposicao[]>(supabase.from('reposicoes').select('*').order('criado_em', { ascending: false })),
  })
export const useProfiles = (enabled = true) =>
  useQuery({ queryKey: ['profiles'], enabled, queryFn: () => run<Profile[]>(supabase.from('profiles').select('*').order('criado_em')) })

/** Mutação simples com mensagem de erro amigável. */
export async function exec(q: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await q
  if (error) throw new Error(error.message)
}

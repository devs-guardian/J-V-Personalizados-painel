import { z } from 'zod'
import { paraNumero } from './format'

interface Regras { min?: number; max?: number; maiorQue?: number; inteiro?: boolean }

/** Texto digitado (aceita vírgula) convertido em número. Vazio ou inválido vira erro, nunca zero. */
export function numero({ min, max, maiorQue, inteiro }: Regras = {}) {
  let n = z.number({ error: 'Número inválido' })
  if (inteiro) n = n.int('Use um número inteiro')
  if (min != null) n = n.min(min, `O mínimo é ${min.toLocaleString('pt-BR')}`)
  if (max != null) n = n.max(max, `O máximo é ${max.toLocaleString('pt-BR')}`)
  if (maiorQue != null) n = n.gt(maiorQue, `Precisa ser maior que ${maiorQue.toLocaleString('pt-BR')}`)
  return z
    .string()
    .trim()
    .min(1, 'Preencha este campo')
    .transform(paraNumero)
    .pipe(n)
}

export const obrigatorio = (mensagem: string) => z.string().trim().min(1, mensagem)
export const texto = z.string().trim()
export const email = z.string().trim().min(1, 'Informe o e-mail').pipe(z.email('E-mail inválido'))

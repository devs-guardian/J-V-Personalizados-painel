# Filamento por cor em cada produto: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastrar as cores de cada produto para saber o que falta comprar e baixar o estoque por cor.

**Architecture:** A receita fica em `produtos.cores`; o banco copia o consumo por unidade para `pedido_itens.cores` (gatilhos), porque a operação não lê produtos. O app calcula reservado, sobra e compra a partir dos itens, com funções puras.

**Tech Stack:** Supabase (Postgres), React 19, React Hook Form + Zod, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-11-25-cores-por-produto-design.md`

## Global Constraints

- Rolo = 1 kg (1000 g). Consumo, estoque e mínimo em gramas.
- `005` roda depois do `004` e pode ser rodado mais de uma vez.
- Antes do `005`, o app funciona como hoje (sem seção de cores; conclusão com um filamento).
- A operação não ganha acesso a produtos nem a preços.
- Textos em português. Sem commits (o usuário não pediu); o projeto continua sem suíte de testes, então os testes ficam no scratchpad (`sql.mjs` com PGlite, `e2e.mjs` com Supabase simulado).

## Review Focus

- Digitar `1.000` em campo de gramas: deve valer mil, e `1,5` ou `1.5` um e meio.
- Receita apontando para filamento desativado: aparece "Filamento removido" e a conclusão não falha.
- Duas telas concluindo o mesmo pedido: o estoque baixa uma única vez.
- Soma de cores com decimais (ex.: 0,1 + 0,2): o total mostra 0,3.
- Produto excluído com pedido em aberto: o item mantém as cores copiadas.

---

### Task 1: Banco (`005`)

**Files:**
- Create: `supabase/005_cores_por_produto.sql`
- Test: `<scratchpad>/sql.mjs` (esquema real `001`, `004`, `005`)

**Interfaces (Produces):**
- `produtos.cores jsonb not null default '{}'`: `{ filamento_id: gramas }`, mesma base de `produtos.gramas`.
- `pedido_itens.cores jsonb not null default '{}'`: `{ filamento_id: gramas por unidade }`, já com purga e falhas.
- Gatilho antes de gravar produto: se há cores, `gramas = soma(cores)`.
- Gatilho antes de inserir item: se o produto tem cores, `item.cores[f] = item.gramas * cores[f] / soma`.
- Gatilho depois de alterar `cores`, `purga` ou `falhas` do produto: nos pedidos `novo` e `producao`, `item.gramas = (soma + purga) * (1 + falhas)` e `item.cores` proporcional. Cores removidas: `item.cores = '{}'`, gramas mantidos.
- `concluir_pedido_cores(p_id uuid, p_consumo jsonb) returns void`, com `p_consumo = [{ "fil_id": uuid, "gramas": numeric }]`. Exige `is_equipe()`; recusa gramas negativos; se o pedido não estava `novo`/`producao`, não faz nada; estoque nunca fica abaixo de zero.
- `concluir_pedido` antigo continua existindo, também sem baixar duas vezes.

- [ ] **Step 1:** Testes: `produto grava a soma em gramas`; `item novo recebe cores proporcionais` (cores 400/100, purga 0, falhas 0.1, item.gramas 550 → 440/110); `salvar cores atualiza pedido novo e em producao`; `pronto, enviado e cancelado nao mudam`; `concluir baixa todas as cores`; `concluir de novo nao baixa` (nas duas funções); `gramas negativos sao recusados`; `excluir produto mantem cores do item`; `script roda duas vezes`.
- [ ] **Step 2:** Rodar `node sql.mjs supabase`. Esperado: FAIL (arquivo não existe).
- [ ] **Step 3:** Escrever o `005`.
- [ ] **Step 4:** Rodar de novo. Esperado: tudo PASS.

### Task 2: Cálculos e leitura de números

**Files:**
- Create: `src/lib/consumo.ts`
- Modify: `src/lib/types.ts`, `src/lib/queries.ts`, `src/lib/zod.ts`, `src/lib/format.ts`
- Test: `<scratchpad>/consumo.mjs`

**Interfaces (Produces):**
- `Produto.cores?: Record<string, number>`, `PedidoItem.cores?: Record<string, number>`
- `useTemCores(): boolean` (consulta `pedido_itens.select('cores').limit(1)`; erro = `false`)
- `consumoDoPedido(p: Pedido): Record<string, number>` (soma `qtd * cores`)
- `reservadoPorFilamento(pedidos: Pedido[]): Record<string, number>` (só `novo` e `producao`)
- `aCaminhoPorFilamento(reps: Reposicao[]): Record<string, number>` (`pendente`/`aprovado`, não recebido, com `fil_id`, unidade começando em `kg`; vezes 1000)
- `produtosSemCores(pedidos: Pedido[]): string[]` (nomes únicos em pedidos em aberto)
- `situacaoEstoque(f: Filamento, reservado: number, aCaminho: number): { sobra: number; comprar: number; rolos: number; situacao: 'falta' | 'repor' | 'ok' }`, com `sobra = estoque - reservado`, `d = sobra + aCaminho`, `comprar = max(0, min - d)`, `rolos = ceil(comprar / 1000)`, `falta` se `d < 0`, `repor` se `d <= min`.
- `paraNumero(s: string): number`, usado por `numero()`, `precoFixo` e `parseNum`: com vírgula, pontos são milhar; sem vírgula, `^\d{1,3}(\.\d{3})+$` com primeiro grupo diferente de `0` é milhar; senão o ponto é decimal.

- [ ] **Step 1:** Testes: `situacao: 100 estoque, 150 reservado, min 300 -> falta, comprar 350, 1 rolo`; `100, 26, a caminho 1000 -> ok`; `igual ao minimo -> repor, comprar 0`; `a caminho ignora negado, recebido e unidade un`; `paraNumero: "1.000"->1000, "1.234,5"->1234.5, "1,5"->1.5, "1.5"->1.5, "0.125"->0.125, "abc"->NaN`.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Esperado: PASS; `npm run build` sem erros.

### Task 3: Cores no produto

**Files:**
- Create: `src/components/cores-field.tsx` (linhas filamento + gramas, para produto e conclusão)
- Modify: `src/pages/comercial/Produtos.tsx`
- Test: `<scratchpad>/e2e.mjs`

**Interfaces:**
- Consumes: `ComboboxField`, `NumberField`, `useFilamentos`, `useTemCores`
- Produces: `CoresField({ form, filamentos, minimo })`, sobre o campo de formulário `cores: { fil_id: string; gramas: string }[]`

- [ ] **Step 1:** Testes: `adicionar duas cores soma o peso e bloqueia o campo`; `filamento repetido mostra "Filamento repetido"`; `gramas 0 e recusado`; `salvar envia cores {f1:400,f2:100}`; `0,1 + 0,2 mostra 0,3`; `filamento desativado aparece como "Filamento removido"`; `sem o 005 a secao nao aparece e o envio nao leva cores`.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar; ao salvar, invalidar `produtos` e `pedidos`.
- [ ] **Step 4:** Rodar. Esperado: PASS.

### Task 4: Estoque

**Files:**
- Modify: `src/pages/operacional/Estoque.tsx`
- Test: `<scratchpad>/e2e.mjs`

**Interfaces (Consumes):** funções de `consumo.ts`, `usePedidos`, `useReposicoes`.

Colunas: Cor, Material, Estoque, Reservado, A caminho, Sobra, Mínimo, Comprar, Situação ("Falta", "Repor", "OK"). Subtítulo conta as cores com "Falta" ou "Repor". "Comprar" mostra `350 g (1 rolo)` ou `—`. Aviso com `Alert`: "Pedidos em aberto sem cores cadastradas: <nomes>. Eles não entram no reservado." "Solicitar reposição" vira formulário com quantidade em kg (padrão `max(1, rolos)`). Campos Estoque e Mínimo ganham a descrição "Em gramas. Um rolo de 1 kg = 1000".

- [ ] **Step 1:** Testes: `tabela mostra reservado, sobra e comprar`; `aviso lista produto sem cores`; `reposicao sugere 2 rolos para comprar 1350 g e envia qtd 2`; `antes do 005 a tabela fica como hoje`.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar. Esperado: PASS.

### Task 5: Conclusão e documentação

**Files:**
- Modify: `src/pages/operacional/Fila.tsx`, `README.md`
- Test: `<scratchpad>/e2e.mjs`

**Interfaces (Consumes):** `consumoDoPedido`, `CoresField`, `concluir_pedido_cores`.

A janela abre com uma linha por cor (gramas arredondados, editáveis) e permite adicionar ou remover linhas. Nenhuma linha = não baixa estoque. Item sem cores: texto "Há itens sem cores cadastradas; acrescente o filamento usado, se quiser baixar o estoque."

- [ ] **Step 1:** Testes: `abre com as cores calculadas`; `envia p_consumo editado`; `sem linhas envia []`; `antes do 005 usa a janela antiga`.
- [ ] **Step 2:** Rodar. Esperado: FAIL.
- [ ] **Step 3:** Implementar; no README, incluir o `005` e explicar reservado e comprar.
- [ ] **Step 4:** Rodar `sql.mjs`, `consumo.mjs`, `e2e.mjs` e `npm run build`. Esperado: tudo PASS e sem erros no console; restaurar `tsconfig.tsbuildinfo` e apagar `dist/`.

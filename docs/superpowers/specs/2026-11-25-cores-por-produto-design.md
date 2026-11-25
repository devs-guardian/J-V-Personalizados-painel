# Filamento por cor em cada produto

Status: aguardando aprovação.

## Por quê
Saber qual cor repor, sem comprar mais do que o necessário. Hoje o produto guarda só o peso total, o filamento é escolhido apenas na conclusão e só um por pedido.

## Objetivos
- Cadastrar no produto os gramas de cada cor. As cores de um produto são sempre as mesmas.
- Mostrar no estoque quanto de cada cor os pedidos em aberto vão consumir e quanto falta comprar.
- Baixar o estoque de todas as cores ao concluir o pedido.

## Fora do escopo
- Escolher cores diferentes por pedido ou por cliente.
- Preço de filamento diferente por cor (o cálculo continua com um único R$/kg).
- Compra automática.

## Abordagens consideradas
| Abordagem | Troca | Decisão |
|---|---|---|
| Cores fixas no produto | cadastro uma única vez; não cobre variação por cliente | **escolhida**: as cores nunca mudam |
| Cores informadas em cada pedido | flexível; trabalho a cada venda | descartada |
| Padrão no produto, ajustável no pedido | cobre exceções que hoje não existem | descartada |

## Como funciona

### Produto
- Nova seção "Cores": linhas com filamento (pesquisável) e gramas, sem repetir filamento.
- Com cores cadastradas, o campo de gramas passa a ser a soma delas (somente leitura). Sem cores, continua digitável.
- Os gramas seguem a mesma base do campo atual. Purga e falhas são divididas entre as cores na mesma proporção.

### Pedido
- Cada item guarda o consumo por unidade de cada cor no momento da criação. A operação não lê a tabela de produtos, por isso o dado precisa estar no item.
- Ao salvar as cores de um produto, o banco atualiza os itens dos pedidos em aberto (novo e em produção) desse produto. Assim os 2 pedidos atuais passam a ser calculados. Pedidos prontos, enviados e cancelados não mudam.

### Estoque
Por filamento:
- **Reservado**: consumo dos pedidos novos e em produção.
- **A caminho**: reposições pendentes ou aprovadas e ainda não recebidas, em kg.
- **Sobra** = estoque - reservado.
- **Comprar** = mínimo - (sobra + a caminho), quando positivo.
- Situação: "Falta" (sobra + a caminho abaixo de zero), "Repor" (menor ou igual ao mínimo), "OK".
- "Solicitar reposição" sugere a quantidade em rolos inteiros de 1 kg que cobre o "Comprar", editável.
- Aviso quando houver pedidos em aberto com itens sem cores, com os nomes dos produtos.

### Conclusão
- A janela lista cada cor com os gramas calculados, editáveis, e baixa todas de uma vez, em uma única operação no banco.
- Pedido com itens sem cores: permite acrescentar linhas de filamento manualmente. Continua opcional baixar o estoque.
- Concluir um pedido já concluído não baixa o estoque de novo.

## Restrições
- Novo script `supabase/005_...sql`, que o usuário roda no SQL Editor, depois do `004`. Pode ser rodado mais de uma vez.
- Antes do script, o aplicativo não pode quebrar.
- A separação de acesso continua no banco (operação não vê preços).

## A critério de quem implementa
Formato das colunas, nomes das funções SQL e organização do código.

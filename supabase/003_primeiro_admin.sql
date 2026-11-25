-- Depois de criar seu usuário em Authentication > Users (e-mail + senha),
-- torne-o gestão trocando o e-mail abaixo. Os demais você libera pelo app (aba Usuários).
update profiles set role = 'gestao' where email = 'SEU-EMAIL@exemplo.com';

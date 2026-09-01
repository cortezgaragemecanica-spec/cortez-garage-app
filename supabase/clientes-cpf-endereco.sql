alter table public.clientes add column if not exists cpf text;
alter table public.clientes add column if not exists endereco text;

create index if not exists clientes_cpf_idx
on public.clientes(cpf)
where cpf is not null and cpf <> '';

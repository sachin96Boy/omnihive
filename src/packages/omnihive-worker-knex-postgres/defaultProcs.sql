select proc.specific_schema as proc_schema,
	proc.routine_name as proc_name,
	args.ordinal_position as parameter_position,
	args.parameter_name,
	args.data_type as parameter_type_database,
	case
		args.data_type
		when 'boolean' then 'boolean'
		when 'character varying' then 'string'
		when 'character' then 'string'
		when 'varchar' then 'string'
		when 'char' then 'string'
		when 'text' then 'string'
		when 'uuid' then 'string'
		when 'json' then 'string'
		when 'smallint' then 'number'
		when 'integer' then 'number'
		when 'bigint' then 'number'
		when 'decimal' then 'number'
		when 'numeric' then 'number'
		when 'real' then 'number'
		when 'double precision' then 'number'
		when 'smallserial' then 'number'
		when 'serial' then 'number'
		when 'bigserial' then 'number'
		when 'money' then 'number'
		when 'date' then 'Date'
		else 'unknown'
	end as parameter_type_entity
from information_schema.routines proc
	left join information_schema.parameters args on proc.specific_schema = args.specific_schema
	and proc.specific_name = args.specific_name
where proc.routine_schema not in ('pg_catalog', 'information_schema')
	and proc.routine_schema not like 'pg_temp%'
	and proc.routine_type = 'PROCEDURE'
	and args.parameter_mode in ('IN', 'INOUT')
order by proc.specific_schema,
	proc.routine_name,
	args.ordinal_position;
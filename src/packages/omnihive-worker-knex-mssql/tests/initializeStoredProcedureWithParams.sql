create procedure test_stored_procedure_with_params
    (@value varchar(1000),
     @numeric int)
as
begin

select convert(varchar(1000), @value) + ' ' + convert(varchar(1000), @numeric) as dataresult

end
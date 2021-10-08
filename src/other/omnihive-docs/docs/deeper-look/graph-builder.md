---
title: Graph to SQL Translator
---

# GraphQL to SQL Translator

The GraphQL to SQL translator takes any database connected to your configuration and builds a full CRUD GraphQL Schema.
The schema is generated in two distinct portions. Query and Mutation. By default any GraphQL query passed in will default to Query.

# Query

The query schema controls all of the get commands you can pass into a graph query as well as any aggregate function.

## Query Objects

The main schema object consist of the database schema name followed by the table you are querying in a camel case format. i.e. dboWorkers.
The objects contain sub-objects of every column inside of that table as well as any table linked to it. A simple lookup query could look
something like below:

```graphql
{
    dboWorkers {
        firstName
        lastName
    }
}
```

## Table Arguments

Each table object has a set of arguments that can be passed in to modify the returned result set. These arguments consist of the following:

-   <strong>where</strong>: Used to limit the result set returned.
-   <strong>orderBy</strong>: Sort the result set returned by a column.
-   <strong>groupBy</strong>: Group the result set returned by a column.
-   <strong>limit</strong>: Limit the amount of records in the result set returned.
-   <strong>page</strong>: Determines which set of values in the result set returned. Meaning if page = 2 and limit = 10 then the 11th thru 20th values will be returned.

### Where

The where argument builds out a sql based where clause using a graphql syntax that is easy to understand and read. The Graph Playground provides users with assisted suggestions built from the generated schema.
The where objects properties contain the parent table's column names in camel case as well as an "and" and "or" property which takes an array of camel cased column names. Each one of the column properties takes
a separate object to set the equality. These equality properties are as follows:

-   <strong>eq</strong>: Equals comparer,
-   <strong>notEq</strong>: Not Equals comparer,
-   <strong>like</strong>: Similar comparer. Enables the use of language specific wildcards for a similar comparer instead of exact matches,
-   <strong>notLike</strong>: Not similar comparer. Enables the use of language specific wildcards for a not similar comparer instead of exact matches,
-   <strong>gt</strong>: Greater than comparer,
-   <strong>gte</strong>: Greater than or equal to comparer,
-   <strong>notGt</strong>: Not greater than comparer,
-   <strong>notGte</strong>: Not greater than or equal to comparer,
-   <strong>lt</strong>: Less than comparer,
-   <strong>lte</strong>: Less than or equal to comparer,
-   <strong>notLt</strong>: Not less than comparer,
-   <strong>notLte</strong>: Not less than or equal to comparer,
-   <strong>in</strong>: In list comparer. Accepts an array of the columns data type,
-   <strong>notIn</strong>: Not in list comparer. Accepts an array of the columns data type,
-   <strong>isNull</strong>: Is null comparer. Returns if the column value is null and this property is set to true,
-   <strong>isNotNull</strong>: Is not null comparer. Returns if the column value is not null and this property is set to true,
-   <strong>exists</strong>: Exists comparer. Useful when using the Raw SQL sub-property,
-   <strong>notExists</strong>: Not exists comparer. Useful when using the Raw SQL sub-property,
-   <strong>between</strong>: Between comparer. Value exists between the two provided values,
-   <strong>notBetween</strong>: Not between comparer. Value does not exists between the two provided values,

Each equality property has the ability to contain a sub-object with a "raw" property to pass in raw sql into the comparer as shown below.

```graphql title="Using Raw Example"
{
    dboWorker(where: { id: { exists: { raw: "select id from workers as w where w.last_name = 'Benson'" } } }) {
        firstName
        lastName
    }
}
```

### OrderBy

The orderBy argument allows you to order the results you get back by a specific column. The object contains and array of objects whose properties contain the table's column names with the value of their sort order.
It is important that only one column is listed per object. This is the only way to guarantee what order the results get sorted in.

```graphql title="Order By Example"
{
    dboWorker(orderBy: [{ lastName: desc }, { firstName: desc }]) {
        firstName
        lastName
    }
}
```

### Limit

The limit argument is used to limit the amount of results that are returned from the query.

```graphql title="Limit Example"
{
    dboWorker(limit: 100) {
        firstName
        lastName
    }
}
```

### Page

The page argument is used for pagination. This enables the query to paginate its data.

:::warning
If the orderBy argument and limit argument are not used then using the page argument is not useful. Order by is needed to paginate accurately because without an
order the results are returned in a random order. Limit is needed because without a limit going to another page will return nothing.
:::

```graphql title="Page Example"
{
    dboWorker(orderBy: [{ lastName: desc }, { firstName: desc }], limit: 100, page: 2) {
        firstName
        lastName
    }
}
```

### GroupBy **_ (Work in progress) _**

The groupBy command is very useful for consolidating similar types of data. This is most useful when dealing with aggregate functions. There are two properties for this argument are "columns" and "having".
The columns object contains an array of the selected table's columns. The having object is identical to the table's [where object](./graph-builder#where).

<!-- ``` graphql title="Group By Example"
{
    dboWorker_aggregate {
        count()
    }
}
``` -->

### Linking tables

When building a graph query you have the ability to link two tables together through their relationships. This property contains all of the arguments available to a table query. However, the linking table adds another argument to the table object called "join" This argument object holds data related how you want to join the results together.

```graphql title="Linking Example"
{
    dboWorker {
        firstName
        lastName
        dboWorkerJob_table(join: { type: inner, whereMode: specific, from: workerId }) {
            jobId_table(join: { type: inner, whereMode: specific }, where: { danger_level: { eq: "high" } }) {
                name
            }
        }
    }
}
```

#### Join Object

The argument holds 3 properties "type", "whereMode", "from".

##### Type

The type argument determines what type of join you wish to make. These are SQL based joins.

-   <strong>inner</strong>: Returns data from both tables if the columns being compared match
-   <strong>left</strong>: Returns data from both tables. If the columns being compared do not match, nulls for the table's columns are returned instead of column data for the tabling being joined to.
-   <strong>leftOuter</strong>: Same function as a left join
-   <strong>right</strong>: Returns data from both tables. The table being joined to will always return data. If there is no data in the primary table that matches the compared values then nulls are returned instead of data.
-   <strong>rightOuter</strong>: Same function as a right join
-   <strong>fullOuter</strong>: The combination of right and left joins. All data is returned if matching values can not be found then nulls are returned in its place.
-   <strong>cross</strong>: Returns the Cartesian product of rows from tables in the join.

##### Where Mode

Where mode determines where the [where object](./graph-builder#where) arguments is located in the sql query. The "specific" mode puts the where clause in the join itself giving you the ability to have flexible joins. The "global" mode puts the where clause in the main where clause of the sql query making the where argument affect the entire query not just the join.

##### From

The "from" argument is only included for joins to another table that do not have a column specifically linking to another table. This is common in cases of another table linking to the primary query table. In this scenario the "from" argument will hold which column on the foreign table is being used to link the two tables together. i.e. In the example above the dboWorkerJobs table is being linked to from the column dboWorkerJobs.worker_id.

### Aggregates

Each table has an aggregate counter part. These separate query objects are used to aggregate data together. This is used for statistics purposes mostly but the use cases are vast.

#### Count

The count property counts the rows of the query. The count property takes two arguments.

-   <strong>column</strong>: The name of the column you are wanting to count
-   <strong>distinct</strong>: Optional argument the determine if you only want to count unique values or all values.

```graphql title="Count Example"
{
    dboJob {
        name
        dboWorkerJobs_aggregate(
            join: { type: inner, whereMode: specific, from: jobId }
            where: { active: { eq: true } }
        ) {
            count(column: id, distinct: true)
        }
    }
}
```

#### Min

The min property counts the rows of the query. The min property takes one arguments.

-   <strong>column</strong>: The name of the column you are wanting to min.

```graphql title="Min Example"
{
    dboJob_aggregate {
        min(column: basePay)
    }
}
```

#### Max

The max property counts the rows of the query. The max property takes one arguments.

-   <strong>column</strong>: The name of the column you are wanting to max.

```graphql title="Max Example"
{
    dboJob_aggregate {
        max(column: basePay)
    }
}
```

#### Sum

The sum property counts the rows of the query. The sum property takes two arguments.

-   <strong>column</strong>: The name of the column you are wanting to sum.
-   <strong>distinct</strong>: Optional argument the determine if you only want to count unique values or all values.

```graphql title="Sum Example"
{
    dboWorkers_aggregate(where: { active: { eq: true } }) {
        sum(column: wage)
    }
}
```

#### Average

The average property takes the average of the rows of the query. The average property takes two arguments.

-   <strong>column</strong>: The name of the column you are wanting to average.
-   <strong>distinct</strong>: Optional argument the determine if you only want to count unique values or all values.

```graphql title="Average Example"
{
    dboJob_aggregate {
        avg(column: basePay)
    }
}
```

# Mutation

## Insert

The insert mutation is used to insert rows of data into the database. This query takes in one argument.

-   <strong>insert</strong>: An array of objects containing values to insert into a new row of data. All non-nullable columns are required for this query.

The return of this query can contain any row in the reference table.

```graphql title="Insert Example"
mutation {
    insert_dboWorkers(
        insert: [
            { firstName: "Barry", middleName: "B", lastName: "Benson", wage: 10, graduated: "2007-11-02" }
            { firstName: "Adam", lastName: "Flayman", wage: 5, graduated: "2007-11-02" }
            { firstName: "Mooseblood", lastName: "Mosquito" }
        ]
    ) {
        id
        firstName
        lastName
    }
}
```

## Update

The update mutation is used to update one or multiple rows of data. This query can return anything on the parent object. This query takes in two arguments.

-   <strong>updateTo</strong>: Object of values to update
-   <strong>where</strong>: A <a href="./graph-builder#where">where object</a> to determine which values to update

The return of this query can contain anything column in the referenced table.

```graphql title="Update Example"
mutation {
    update_dboWorkers(updateTo: { wage: { raw: "null" } }, where: { active: { eq: false } }) {
        id
        firstName
        lastName
    }
}
```

## Delete

The delete mutation is used to delete one or multiple rows of data. This query takes in one argument.

-   <strong>where</strong>: A <a href="./graph-builder#where">where object</a> to determine which values to delete

The value that is returned is the number of rows that were deleted.

```graphql title="Delete Example"
mutation {
    delete_dboWorkers(updateTo: { where: { id: { in: [1, 3, 10] } })
}
```

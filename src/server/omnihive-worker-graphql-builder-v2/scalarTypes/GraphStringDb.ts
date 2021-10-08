import { UserInputError } from "apollo-server";
import { GraphQLScalarType } from "graphql";
import { Kind } from "graphql/language";

export default new GraphQLScalarType({
    name: "DbString",
    description: "Graph String value that accepts raw db input.",
    parseValue(value) {
        return value;
    },
    serialize(value) {
        return value.toString();
    },
    parseLiteral(ast) {
        return parseAst(ast);
    },
});

function parseObject(ast: any) {
    const value: { raw: string } = { raw: "" };
    ast.fields.forEach((field: any) => {
        if (field.name.value === "raw") {
            value.raw = parseAst(field.value);
        } else {
            throw new UserInputError("Only string values and { raw: string } values are allowed.");
        }
    });
    return value;
}

function parseAst(ast: any) {
    switch (ast.kind) {
        case Kind.STRING:
            return ast.value;
        case Kind.OBJECT:
            return parseObject(ast);
        default:
            throw new UserInputError("Only string values and { raw: string } values are allowed.");
    }
}

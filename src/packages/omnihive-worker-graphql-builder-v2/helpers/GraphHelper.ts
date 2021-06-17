export class GraphHelper {
    public getGraphTypeFromEntityType = (entityType: string): string => {
        switch (entityType) {
            case "string":
                return `String`;
            case "number":
                return `Int`;
            case "boolean":
                return `Boolean`;
            case "Date":
                return `String`;
            default:
                return `String`;
        }
    };
}

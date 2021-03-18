export class StringHelper {
    public static isNullOrWhiteSpace(value: string): boolean {
        if (!value || value === "undefined" || value === "null" || value === "") {
            return true;
        }

        return value.replace(/\s/g, "").length < 1;
    }

    public static capitalizeFirstLetter(value: string) {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }
}

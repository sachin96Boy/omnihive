export class StringHelper {

    public static isNullOrWhiteSpace(value: string): boolean {
        try {
            if (!value || value === "undefined" || value === "null" || value === "") {
                return true;
            }

            return value.toString().replace(/\s/g, "").length < 1;
        } catch (e) {
            return false;
        }
    }

    public static capitalizeFirstLetter(value: string) {
        return value.charAt(0).toUpperCase() + value.slice(1);
      }
}

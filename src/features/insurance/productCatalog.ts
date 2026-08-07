export const itemsData = [
    { name: "Tender Coconut", hsn: "08011910" },
    { name: "Kiwi", hsn: "08105000" },
    { name: "Mango", hsn: "08045020" },
    { name: "Banana", hsn: "08039010" },
    { name: "Apple", hsn: "08081000" },
    { name: "Papaya (Papita)", hsn: "08072000" },
    { name: "Pomegranate (Anar)", hsn: "08109010" },
    { name: "Oranges", hsn: "08051000" },
    { name: "Kinnow", hsn: "08052100" },
    { name: "Guava (Amrood)", hsn: "08045010" },
    { name: "Muskmelon (Kastoori Tarbooj)", hsn: "08071910" },
    { name: "Watermelon (Tarbooj)", hsn: "08071100" },
    { name: "Pista", hsn: "08025200" },
    { name: "Tomato", hsn: "07020000" },
    { name: "Onion", hsn: "07031010" },
    { name: "Potato", hsn: "07019000" },
    { name: "Ginger (Fresh)", hsn: "07030010" },
    { name: "Sweet Potato", hsn: "07142000" },
    { name: "Mosambi (Sweet Lime)", hsn: "08059000" },
    { name: "Grapes", hsn: "08061000" },
] as const;

export const getHsnForProduct = (productName: string) =>
    itemsData.find((item) => item.name === productName)?.hsn || '';

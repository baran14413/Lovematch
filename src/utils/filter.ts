/**
 * LOVEMATCH - KÜFÜR VE ARGO FİLTRESİ (v1.6)
 * Admin panelinden yönetilebilir şekilde tasarlanmıştır.
 */

// Varsayılan küfür listesi (Admin panelinden yenilendiğinde güncellenir)
export let BAD_WORDS = ['sexs', 'yarak', 'am', 'meme', 'sik', 'göt', 'piç', 'yavşak', 'oruspu', 'kahpe'];

/**
 * Verilen metindeki küfürleri temizler (*** ile değiştirir)
 */
export const cleanText = (text: string, customWords?: string[]): string => {
    if (!text) return '';
    let filteredText = text;
    const wordsToFilter = customWords || BAD_WORDS;

    wordsToFilter.forEach(word => {
        // Case-insensitive ve kelime öbeği olarak eşleştir
        const regex = new RegExp(word, 'gi');
        filteredText = filteredText.replace(regex, (match) => '*'.repeat(match.length));
    });

    return filteredText;
};

/**
 * Metinde küfür olup olmadığını kontrol eder
 */
export const hasBadWords = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return BAD_WORDS.some(word => lowerText.includes(word.toLowerCase()));
};

/**
 * Listeyi güncelle (Uygulama çalışma zamanında admin verisine göre)
 */
export const updateBadWordsList = (newList: string[]) => {
    if (newList && newList.length > 0) {
        BAD_WORDS = newList;
    }
};

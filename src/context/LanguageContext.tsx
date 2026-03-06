import React, { createContext, useContext, useState } from 'react';
import { translations, getLanguage, Language } from '../utils/languages';

interface LanguageContextType {
    language: Language;
    t: (key: string) => string;
    setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLangState] = useState<Language>(getLanguage());

    const setLanguage = (lang: Language) => {
        setLangState(lang);
        localStorage.setItem('app_lang', lang);
    };

    const t = (key: string) => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, t, setLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

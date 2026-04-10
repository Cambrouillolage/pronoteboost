import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Sparkles, Tag, Type, Zap } from "lucide-react";

export function CreateAccount() {
  const navigate = useNavigate();
  const storedProfile = localStorage.getItem("pronoteBoost_styleProfile");
  const initialProfile = (() => {
    if (!storedProfile) {
      return { subject: "", favoriteWords: [], favoritePhrases: [] };
    }

    try {
      const parsed = JSON.parse(storedProfile);
      return {
        subject: typeof parsed.subject === "string" ? parsed.subject : "",
        favoriteWords: Array.isArray(parsed.favoriteWords) ? parsed.favoriteWords : [],
        favoritePhrases: Array.isArray(parsed.favoritePhrases) ? parsed.favoritePhrases : [],
      };
    } catch {
      return { subject: "", favoriteWords: [], favoritePhrases: [] };
    }
  })();

  const [subject, setSubject] = useState(initialProfile.subject || "");
  const [favoriteWords, setFavoriteWords] = useState(
    Array.isArray(initialProfile.favoriteWords) ? initialProfile.favoriteWords : [],
  );
  const [favoritePhrases, setFavoritePhrases] = useState(
    Array.isArray(initialProfile.favoritePhrases) ? initialProfile.favoritePhrases : [],
  );
  const [newWord, setNewWord] = useState("");
  const [newPhrase, setNewPhrase] = useState("");

  const addWord = () => {
    const trimmed = newWord.trim();
    if (!trimmed || favoriteWords.includes(trimmed)) {
      return;
    }
    setFavoriteWords([...favoriteWords, trimmed]);
    setNewWord("");
  };

  const addPhrase = () => {
    const trimmed = newPhrase.trim();
    if (!trimmed || favoritePhrases.includes(trimmed)) {
      return;
    }
    setFavoritePhrases([...favoritePhrases, trimmed]);
    setNewPhrase("");
  };

  const saveAndContinue = () => {
    localStorage.setItem(
      "pronoteBoost_styleProfile",
      JSON.stringify({
        subject: subject.trim(),
        favoriteWords,
        favoritePhrases,
      }),
    );
    navigate("/generate");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-[#396155] flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-base text-gray-900">Ton style d'annotation</h1>
        </div>
        <p className="text-xs text-gray-600">
          Renseigne ta matière, tes raccourcis d'appréciation et les phrases que tu utilises souvent.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <label className="mb-2 flex items-center gap-2 text-xs text-gray-700">
            <Type className="w-4 h-4 text-[#396155]" />
            Matière
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex: Français"
            className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#396155] text-xs"
          />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <label className="mb-2 flex items-center gap-2 text-xs text-gray-700">
            <Tag className="w-4 h-4 text-[#396155]" />
            Raccourcis d'appréciation
          </label>
          <p className="text-[11px] text-gray-500 mb-2">
            Ces raccourcis apparaîtront comme quick actions lors de la génération. Ex : "Manque de travail", "Félicitations", "Progrès constants".
          </p>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addWord();
                }
              }}
              placeholder="Ajouter un raccourci"
              className="flex-1 p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#396155] text-xs"
            />
            <button
              onClick={addWord}
              className="px-3 py-2 bg-[#396155] text-white rounded-lg text-xs hover:bg-[#2a4a40] transition-colors"
            >
              Ajouter
            </button>
          </div>
          {favoriteWords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {favoriteWords.map((word: string, index: number) => (
                <button
                  key={`${word}-${index}`}
                  onClick={() =>
                    setFavoriteWords(favoriteWords.filter((_: string, itemIndex: number) => itemIndex !== index))
                  }
                  className="px-2 py-1 rounded-full bg-[#396155]/10 border border-[#396155]/20 text-[#2a4a40] text-[11px]"
                >
                  {word} ×
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <label className="mb-2 flex items-center gap-2 text-xs text-gray-700">
            <Sparkles className="w-4 h-4 text-[#396155]" />
            Phrases que tu aimes
          </label>
          <p className="text-[11px] text-gray-500 mb-2">
            Exemple: Élève sérieux et engagé dans ses apprentissages.
          </p>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newPhrase}
              onChange={(e) => setNewPhrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPhrase();
                }
              }}
              placeholder="Ajouter une phrase"
              className="flex-1 p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#396155] text-xs"
            />
            <button
              onClick={addPhrase}
              className="px-3 py-2 bg-[#396155] text-white rounded-lg text-xs hover:bg-[#2a4a40] transition-colors"
            >
              Ajouter
            </button>
          </div>
          {favoritePhrases.length > 0 && (
            <div className="space-y-2">
              {favoritePhrases.map((phrase: string, index: number) => (
                <div key={`${phrase}-${index}`} className="flex items-start justify-between bg-gray-50 rounded p-2">
                  <span className="text-[11px] text-gray-700 pr-3">{phrase}</span>
                  <button
                    onClick={() =>
                      setFavoritePhrases(
                        favoritePhrases.filter((_: string, itemIndex: number) => itemIndex !== index),
                      )
                    }
                    className="text-xs text-red-600"
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={saveAndContinue}
          className="w-full bg-[#396155] hover:bg-[#2a4a40] text-white py-3 px-4 rounded-lg transition-colors"
        >
          Continuer vers les annotations
        </button>
      </div>
    </div>
  );
}
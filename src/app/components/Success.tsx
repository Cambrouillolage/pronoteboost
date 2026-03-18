import { useNavigate, useSearchParams } from "react-router";
import { CheckCircle, Clock, Zap } from "lucide-react";
import { useEffect, useState } from "react";

export function Success() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const creditsParam = searchParams.get("credits");
  const countParam = parseInt(searchParams.get("count") || "1");
  const failedParam = parseInt(searchParams.get("failed") || "0");
  const sourceParam = searchParams.get("source") || "pronote";
  const [credits, setCredits] = useState(24);
  const [generatedCount, setGeneratedCount] = useState(1);

  useEffect(() => {
    if (creditsParam) {
      setCredits(parseInt(creditsParam));
    }
    
    // Get generation count
    const count = parseInt(localStorage.getItem("pronoteBoost_generatedCount") || "0") + countParam;
    setGeneratedCount(count);
    localStorage.setItem("pronoteBoost_generatedCount", count.toString());
  }, [creditsParam, countParam]);

  const estimatedTime = generatedCount * 3; // 3 minutes per appreciation

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-base text-gray-900">Chrome Extension</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
        {/* Success icon */}
        <div className="mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-lg text-gray-900 mb-2 text-center">
          {sourceParam === "pronote"
            ? `${countParam} appreciation${countParam > 1 ? "s" : ""} ajoutee${countParam > 1 ? "s" : ""} dans Pronote`
            : `${countParam} appreciation${countParam > 1 ? "s" : ""} preparee${countParam > 1 ? "s" : ""} en mode demo`}
        </h2>

        {/* Message */}
        <p className="text-sm text-gray-600 mb-6 text-center">
          {failedParam > 0
            ? `${failedParam} insertion${failedParam > 1 ? "s" : ""} a reprendre manuellement.`
            : "Vous venez de gagner du temps sur votre correction."}
        </p>

        {/* Time saved card */}
        <div className="bg-gradient-to-br from-[#396155] to-[#2a4a40] rounded-xl p-6 mb-6 w-full shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-[#ff981d]" />
            <div className="text-xs text-white/80">Temps estimé gagné aujourd'hui</div>
          </div>
          <div className="text-3xl text-white">+{estimatedTime} minutes</div>
        </div>

        {/* Continue button */}
        <button
          onClick={() => navigate("/")}
          className="w-full bg-[#396155] hover:bg-[#2a4a40] text-white py-3 px-4 rounded-lg transition-colors mb-4"
        >
          Générer la suivante
        </button>

        {/* Credits remaining */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Zap className="w-4 h-4" />
          <span>Crédits restants : {credits}</span>
        </div>
      </div>
    </div>
  );
}

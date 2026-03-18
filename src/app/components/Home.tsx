import { useNavigate } from "react-router";
import { Zap, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";

export function Home() {
  const navigate = useNavigate();
  const [credits, setCredits] = useState(4);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("pronoteBoost_token");
    if (token) {
      setIsLoggedIn(true);
      navigate("/dashboard");
      return;
    }

    // Load credits from localStorage
    const savedCredits = localStorage.getItem("pronoteBoost_credits");
    if (savedCredits) {
      setCredits(parseInt(savedCredits));
    } else {
      localStorage.setItem("pronoteBoost_credits", "4");
    }
  }, [navigate]);

  const handleStart = () => {
    if (credits <= 0) {
      navigate("/create-account");
    } else {
      navigate("/generate");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-[#396155] flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg text-gray-900">Chrome Extension</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Main message */}
        <div className="mb-6">
          <h2 className="text-base mb-2 text-gray-900">
            Gagne du temps sur tes appréciations
          </h2>
          <p className="text-sm text-gray-600">
            4 crédits offerts pour tester l'outil.
          </p>
        </div>

        {/* Credits counter */}
        <div className="bg-gradient-to-br from-[#396155] to-[#2a4a40] rounded-xl p-4 mb-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#ff981d]" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-white/80 mb-1">Crédits restants</div>
              <div className="text-2xl text-white">{credits} / 4</div>
            </div>
          </div>
        </div>

        {/* Social proof */}
        <div className="bg-[#f8f8f9] rounded-lg p-3 mb-6 border border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <TrendingUp className="w-4 h-4 text-[#396155]" />
            <span>2 439 appréciations générées aujourd'hui</span>
          </div>
        </div>

        {/* Button */}
        <div className="space-y-3 mb-6">
          <button
            onClick={handleStart}
            className="w-full bg-[#396155] hover:bg-[#2a4a40] text-white py-3 px-4 rounded-lg transition-colors"
          >
            Commencer
          </button>
        </div>

        {/* Info */}
        <div className="text-xs text-center text-gray-500 py-2 border-t border-gray-200">
          1 appréciation validée = 1 crédit
        </div>
      </div>
    </div>
  );
}
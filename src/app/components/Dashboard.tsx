import { useNavigate } from "react-router";
import { Zap, User, ShoppingCart, LogOut, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";

export function Dashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("pronoteBoost_token");
    if (!token) {
      navigate("/");
      return;
    }

    // Load user data
    const user = localStorage.getItem("pronoteBoost_user");
    if (user) {
      const userData = JSON.parse(user);
      setEmail(userData.email);
    }

    // Load credits
    const savedCredits = localStorage.getItem("pronoteBoost_credits");
    if (savedCredits) {
      setCredits(parseInt(savedCredits));
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("pronoteBoost_token");
    localStorage.removeItem("pronoteBoost_user");
    navigate("/");
  };

  const handleGenerate = () => {
    if (credits <= 0) {
      navigate("/buy-credits");
    } else {
      navigate("/generate");
    }
  };

  const handleGenerateClass = () => {
    if (credits <= 0) {
      navigate("/buy-credits");
    } else {
      navigate("/generate?mode=class");
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
        {/* User card */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#396155] flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm text-gray-900">{email}</div>
                <div className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                  <div className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                  Compte vérifié
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Credits display */}
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Crédits restants</span>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#ff981d]" />
                <span className="text-lg text-gray-900">{credits}</span>
              </div>
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

        {/* Action buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={handleGenerate}
            className="w-full bg-[#396155] hover:bg-[#2a4a40] text-white py-3 px-4 rounded-lg transition-colors"
          >
            Générer pour cet élève
          </button>
          <button
            onClick={handleGenerateClass}
            className="w-full bg-white hover:bg-gray-50 text-[#396155] py-3 px-4 rounded-lg border-2 border-[#396155] transition-colors"
          >
            Générer pour la classe
          </button>
        </div>

        {/* Buy credits link */}
        <button
          onClick={() => navigate("/buy-credits")}
          className="w-full text-sm text-[#396155] hover:underline flex items-center justify-center gap-2 py-2"
        >
          <ShoppingCart className="w-4 h-4" />
          Acheter des crédits
        </button>

        {/* Info */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="text-xs text-center text-gray-500">
            1 appréciation validée = 1 crédit
          </div>
        </div>
      </div>
    </div>
  );
}

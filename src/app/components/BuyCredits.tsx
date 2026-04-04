import { useNavigate } from "react-router";
import { Check, Shield } from "lucide-react";
import { useState } from "react";

const packs = [
  {
    id: 1,
    name: "Pack Découverte",
    credits: 200,
    approximation: "≈ 6 classes",
    price: "1,99 €",
    pricePerCredit: "0,01 €/crédit",
    popular: true,
    badge: "Offre de lancement",
  },
  {
    id: 2,
    name: "Pack Starter",
    credits: 35,
    approximation: "≈ 1 classe",
    price: "0,99 €",
    pricePerCredit: "0,03 €/crédit",
    popular: false,
  },
  {
    id: 3,
    name: "Pack Trimestre",
    credits: 800,
    approximation: "≈ 24 classes",
    price: "7,99 €",
    pricePerCredit: "0,01 €/crédit",
    popular: false,
  },
];

export function BuyCredits() {
  const navigate = useNavigate();
  const [selectedPack, setSelectedPack] = useState<number | null>(null);

  const handleBuy = (pack: typeof packs[0]) => {
    setSelectedPack(pack.id);
    
    // Simulate purchase
    setTimeout(() => {
      const currentCredits = parseInt(localStorage.getItem("pronoteBoost_credits") || "0");
      const newCredits = currentCredits + pack.credits;
      localStorage.setItem("pronoteBoost_credits", newCredits.toString());
      
      navigate("/dashboard");
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-base text-gray-900">Chrome Extension</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Title */}
        <div className="mb-6">
          <h2 className="text-lg text-gray-900 mb-2">Choisir un pack de crédits</h2>
          <p className="text-sm text-gray-600">
            Ton compte est actif. Choisis un pack pour continuer à générer des appréciations.
          </p>
        </div>

        {/* Packs */}
        <div className="space-y-3 mb-6">
          {packs.map((pack) => (
            <div
              key={pack.id}
              className={`relative border-2 rounded-xl p-4 transition-all cursor-pointer ${
                pack.popular
                  ? "border-[#ff981d] bg-gradient-to-br from-[#ff981d]/5 to-transparent shadow-md"
                  : "border-gray-200 hover:border-[#396155]"
              }`}
              onClick={() => handleBuy(pack)}
            >
              {pack.badge && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#ff981d] text-white px-3 py-0.5 rounded-full text-xs font-medium">
                  {pack.badge}
                </div>
              )}
              
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-medium text-gray-900 mb-1">{pack.name}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#396155]">{pack.credits} crédits</p>
                    <span className="text-xs text-gray-400">•</span>
                    <p className="text-xs text-gray-500">{pack.approximation}</p>
                  </div>
                  {pack.pricePerCredit && (
                    <p className="text-xs text-gray-400 mt-1">{pack.pricePerCredit}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${pack.popular ? "text-[#ff981d]" : "text-gray-900"}`}>
                    {pack.price}
                  </div>
                </div>
              </div>

              <button
                className={`w-full py-2.5 px-4 rounded-lg transition-colors font-medium ${
                  selectedPack === pack.id
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : pack.popular
                    ? "bg-[#ff981d] hover:bg-[#e68919] text-white"
                    : "bg-[#396155] hover:bg-[#2a4a40] text-white"
                }`}
                disabled={selectedPack === pack.id}
              >
                {selectedPack === pack.id ? "Traitement..." : "Acheter"}
              </button>
            </div>
          ))}
        </div>

        {/* Advantages */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Avec l'extension :</h3>
          <div className="space-y-2">
            {[
              "Génération instantanée d'appréciations",
              "Personnalisation du ton et du contenu",
              "Gain de temps considérable",
              "Aucun engagement, pas d'abonnement",
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#396155] flex-shrink-0" />
                <span className="text-xs text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Security message */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#396155]" />
          <span className="text-xs text-gray-600">Paiement 100% sécurisé via Stripe</span>
        </div>
      </div>
    </div>
  );
}
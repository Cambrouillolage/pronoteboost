import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, RefreshCw, CheckSquare, Square, Pencil } from "lucide-react";
import {
  fetchStudentsFromPronote,
  insertAppreciationsIntoPronote,
  isExtensionRuntimeAvailable,
} from "../lib/pronoteBridge";
import {
  canUseGeminiApi,
  generateAppreciationWithGemini,
  generateAppreciationsWithGeminiBatch,
  getDailyQuotaStatus,
  type DailyQuotaStatus,
  type GeminiBatchStudentInput,
} from "../lib/gemini";

const sampleAppreciations = {
  bienveillant: "Maxime fournit un travail sérieux et régulier. Sa participation en classe est satisfaisante et ses résultats sont encourageants. Il doit poursuivre ses efforts.",
  neutre: "Élève sérieux et appliqué. Les résultats sont conformes aux attentes. Poursuivre dans cette voie avec la même motivation.",
  pro: "Trimestre satisfaisant. Résultats conformes aux objectifs fixés. Maintenir l'investissement actuel.",
  alarmiste: "Les résultats sont préoccupants et nécessitent une amélioration rapide. Maxime doit redoubler d'efforts pour rattraper son retard.",
};

type Tone = "bienveillant" | "neutre" | "pro" | "alarmiste";

interface Student {
  id: number;
  rowKey?: string;
  name: string;
  average: string;
  tone: Tone;
  selectedPrinciples: string[];
  appreciation: string;
  isSelected: boolean;
  freeText: string;
}

interface StyleProfileData {
  subject: string;
  favoriteWords: string[];
  favoritePhrases: string[];
}

const initialStudents: Student[] = [
  { id: 1, name: "Maxime Bouet", average: "14.5", tone: "neutre", selectedPrinciples: [], appreciation: "", isSelected: true, freeText: "" },
  { id: 2, name: "Sophie Martin", average: "16.2", tone: "neutre", selectedPrinciples: [], appreciation: "", isSelected: true, freeText: "" },
  { id: 3, name: "Lucas Dupont", average: "12.8", tone: "neutre", selectedPrinciples: [], appreciation: "", isSelected: true, freeText: "" },
  { id: 4, name: "Emma Bernard", average: "15.1", tone: "neutre", selectedPrinciples: [], appreciation: "", isSelected: true, freeText: "" },
  { id: 5, name: "Thomas Petit", average: "9.5", tone: "neutre", selectedPrinciples: [], appreciation: "", isSelected: true, freeText: "" },
  { id: 6, name: "Léa Rousseau", average: "17.3", tone: "neutre", selectedPrinciples: [], appreciation: "", isSelected: true, freeText: "" },
];

export function Generate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isClassMode = searchParams.get("mode") === "class";
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [generalTone, setGeneralTone] = useState<Tone>("neutre");
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [studentsSource, setStudentsSource] = useState<"pronote" | "mock">("mock");
  const [infoMessage, setInfoMessage] = useState("");
  const [quotaStatus, setQuotaStatus] = useState<DailyQuotaStatus>(() => getDailyQuotaStatus());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [styleProfile, setStyleProfile] = useState<StyleProfileData>(() => {
    const raw = localStorage.getItem("pronoteBoost_styleProfile");
    if (!raw) {
      return { subject: "", favoriteWords: [], favoritePhrases: [] };
    }

    try {
      const parsed = JSON.parse(raw) as Partial<StyleProfileData>;
      return {
        subject: typeof parsed.subject === "string" ? parsed.subject : "",
        favoriteWords: Array.isArray(parsed.favoriteWords)
          ? parsed.favoriteWords.filter((item): item is string => typeof item === "string")
          : [],
        favoritePhrases: Array.isArray(parsed.favoritePhrases)
          ? parsed.favoritePhrases.filter((item): item is string => typeof item === "string")
          : [],
      };
    } catch {
      return { subject: "", favoriteWords: [], favoritePhrases: [] };
    }
  });

  useEffect(() => {
    setQuotaStatus(getDailyQuotaStatus());
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadStudents = async () => {
      if (!isExtensionRuntimeAvailable()) {
        if (!mounted) {
          return;
        }

        setStudents(initialStudents);
        setStudentsSource("mock");
        setInfoMessage("Mode démo actif: extension Chrome non détectée.");
        setIsLoadingStudents(false);
        return;
      }

      try {
        const pronoteStudents = await fetchStudentsFromPronote();
        if (!mounted) {
          return;
        }

        if (!pronoteStudents.length) {
          throw new Error("Aucun élève visible détecté dans Pronote.");
        }

        setStudents(
          pronoteStudents.map((student, index) => ({
            id: index + 1,
            rowKey: student.rowKey,
            name: student.name,
            average: "",
            tone: "neutre",
            selectedPrinciples: [],
            appreciation: student.appreciation || "",
            isSelected: true,
            freeText: "",
          })),
        );
        setStudentsSource("pronote");
        setInfoMessage(`${pronoteStudents.length} élèves chargés depuis Pronote.`);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setStudents(initialStudents);
        setStudentsSource("mock");
        setInfoMessage(
          `Mode démo actif: ${(error as Error).message || "impossible de lire le tableau Pronote."}`,
        );
      } finally {
        if (mounted) {
          setIsLoadingStudents(false);
        }
      }
    };

    void loadStudents();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedCount = students.filter((student) => student.isSelected).length;
  const selectedWithoutAppreciationCount = students.filter(
    (student) => student.isSelected && !student.appreciation,
  ).length;
  const selectedWithAppreciationCount = students.filter(
    (student) => student.isSelected && student.appreciation,
  ).length;
  const quotaProgressPercent = Math.min(100, Math.max(0, (quotaStatus.used / quotaStatus.limit) * 100));
  const isQuotaReached = quotaStatus.remaining <= 0;

  const buildFallbackAppreciation = (student: Student) => {
    return sampleAppreciations[student.tone].replace("Maxime", student.name.split(" ")[0]);
  };

  const buildTeacherPreferences = () => {
    const preferencesFromWords =
      styleProfile.favoriteWords.length > 0
        ? [`Mots à privilégier: ${styleProfile.favoriteWords.join(", ")}`]
        : [];

    return [...styleProfile.favoritePhrases, ...preferencesFromWords];
  };

  const generateForOneStudent = async (student: Student) => {
    try {
      if (!canUseGeminiApi()) {
        throw new Error("API Gemini non configurée");
      }

      const appreciation = await generateAppreciationWithGemini({
        studentName: student.name,
        average: student.average,
        tone: student.tone,
        principles: student.selectedPrinciples,
        freeText: student.freeText,
        subject: styleProfile.subject,
        teacherPreferences: buildTeacherPreferences(),
      });

      setQuotaStatus(getDailyQuotaStatus());

      return {
        appreciation,
        usedFallback: false,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("Quota quotidien atteint")) {
        throw error;
      }

      setQuotaStatus(getDailyQuotaStatus());
      return {
        appreciation: buildFallbackAppreciation(student),
        usedFallback: true,
        reason: error instanceof Error ? error.message : "Erreur de génération",
      };
    }
  };

  const toggleStudentSelected = (studentId: number) => {
    setStudents(prevStudents => prevStudents.map(s => 
      s.id === studentId ? { ...s, isSelected: !s.isSelected } : s
    ));
  };

  const updateStudentTone = (studentId: number, tone: Tone) => {
    setStudents(prevStudents => prevStudents.map(s => 
      s.id === studentId ? { ...s, tone } : s
    ));
  };

  const toggleStudentPrinciple = (studentId: number, principle: string) => {
    setStudents(prevStudents => prevStudents.map(s => {
      if (s.id === studentId) {
        const selectedPrinciples = s.selectedPrinciples.includes(principle)
          ? s.selectedPrinciples.filter(p => p !== principle)
          : [...s.selectedPrinciples, principle];
        return { ...s, selectedPrinciples };
      }
      return s;
    }));
  };

  const updateFreeText = (studentId: number, freeText: string) => {
    setStudents(prevStudents => prevStudents.map(s => 
      s.id === studentId ? { ...s, freeText } : s
    ));
  };

  const generateForStudent = async (studentId: number) => {
    const student = students.find(s => s.id === studentId);
    if (!student) {
      return;
    }

    if (quotaStatus.remaining <= 0) {
      setInfoMessage("Quota quotidien atteint (20 appels API). Revenez demain après 8h.");
      return;
    }

    setIsGenerating(true);
    let result;
    try {
      result = await generateForOneStudent(student);
    } catch (error) {
      setInfoMessage((error as Error).message || "Quota quotidien atteint.");
      setIsGenerating(false);
      return;
    }

    setStudents(prevStudents => prevStudents.map(s => {
      if (s.id === studentId) {
        return { ...s, appreciation: result.appreciation };
      }
      return s;
    }));

    if (result.usedFallback) {
      setInfoMessage(`Génération locale utilisée (${result.reason || "Gemini indisponible"}).`);
    }

    setIsGenerating(false);
  };

  const handleGenerateClick = () => {
    const count = students.filter(s => s.isSelected).length;
    if (count === 0) return;
    setShowConfirmModal(true);
  };

  const generateAllSelected = async () => {
    const studentsToGenerate = students.filter(s => s.isSelected);
    if (!studentsToGenerate.length) {
      return;
    }

    if (quotaStatus.remaining <= 0) {
      setInfoMessage("Quota quotidien atteint (20 appels API). Revenez demain après 8h.");
      return;
    }

    if (!canUseGeminiApi()) {
      setInfoMessage("API Gemini non configurée. Vérifiez VITE_PRONOTEBOOST_API_URL.");
      return;
    }

    if (studentsToGenerate.length > 30) {
      setInfoMessage("Maximum 30 élèves par requête batch.");
      return;
    }

    setIsGenerating(true);
    setInfoMessage(`Appel IA batch en cours pour ${studentsToGenerate.length} élève(s)...`);

    try {
      const payload: GeminiBatchStudentInput[] = studentsToGenerate.map((student) => ({
        line: student.id,
        firstName: student.name.split(" ")[0] || student.name,
        average: student.average,
        tone: student.tone,
        principles: student.selectedPrinciples,
        freeText: student.freeText,
      }));

      const batchResult = await generateAppreciationsWithGeminiBatch(payload, {
        subject: styleProfile.subject,
        schoolLevel: "Collège",
        teacherPreferences: buildTeacherPreferences(),
      });

      const appreciationByLine = new Map(
        batchResult.map((item) => [String(item.line), item.appreciation]),
      );

      setStudents(prevStudents => prevStudents.map((student) => {
        const appreciation = appreciationByLine.get(String(student.id));
        if (!appreciation) {
          return student;
        }

        return { ...student, appreciation };
      }));

      setQuotaStatus(getDailyQuotaStatus());
      setInfoMessage(`Génération IA terminée pour ${batchResult.length} élève(s).`);
    } catch (error) {
      setQuotaStatus(getDailyQuotaStatus());
      setInfoMessage((error as Error).message || "Échec de génération batch.");
      setIsGenerating(false);
      return;
    }

    setIsGenerating(false);
  };

  const insertAllToPlatform = async () => {
    const selectedStudents = students.filter(s => s.isSelected && s.appreciation);
    if (!selectedStudents.length) {
      return;
    }

    if (studentsSource !== "pronote" || !isExtensionRuntimeAvailable()) {
      navigate(`/success?count=${selectedStudents.length}&source=demo`);
      return;
    }

    setIsInserting(true);

    try {
      const response = await insertAppreciationsIntoPronote(
        selectedStudents.map(student => ({
          rowKey: student.rowKey,
          name: student.name,
          text: student.appreciation,
        })),
      );

      if (!response.inserted) {
        alert("Aucune appréciation n'a pu être insérée dans Pronote.");
        return;
      }

      if (response.failed > 0) {
        setInfoMessage(`${response.inserted} insertion(s) validée(s), ${response.failed} en échec.`);
      }

      navigate(`/success?count=${response.inserted}&failed=${response.failed}&source=pronote`);
    } catch (error) {
      alert((error as Error).message || "Échec de l'insertion dans Pronote.");
    } finally {
      setIsInserting(false);
    }
  };

  const applyGeneralTone = () => {
    setStudents(prevStudents => prevStudents.map(s => ({ ...s, tone: generalTone })));
  };

  const uncheckAll = () => {
    setStudents(prevStudents => prevStudents.map(s => ({ ...s, isSelected: false })));
  };

  const checkAll = () => {
    setStudents((prevStudents) => prevStudents.map((student) => ({ ...student, isSelected: true })));
  };

  const GeneralToneButton = ({ tone, label }: { tone: Tone; label: string }) => (
    <button
      onClick={() => setGeneralTone(tone)}
      className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
        generalTone === tone
          ? "bg-[#396155] text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );

  const StudentToneButton = ({ studentId, tone, label }: { studentId: number; tone: Tone; label: string }) => {
    const student = students.find(s => s.id === studentId);
    return (
      <button
        onClick={() => updateStudentTone(studentId, tone)}
        className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
          student?.tone === tone
            ? "bg-[#396155] text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-base text-gray-900">
              {isClassMode ? "Appréciations de la classe" : "Appréciation du trimestre"}
            </h1>
          </div>
        </div>

        <div className="relative mb-3 overflow-hidden rounded-3xl border border-[#396155]/15 bg-gradient-to-br from-[#396155]/12 via-white to-[#ff981d]/12 p-4 shadow-[0_16px_40px_rgba(57,97,85,0.10)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top_left,rgba(57,97,85,0.18),transparent_55%)]" />
          <div className="pointer-events-none absolute -right-8 bottom-0 h-24 w-24 rounded-full bg-[#ff981d]/10 blur-2xl" />

          <div className="relative">
            <div>
              <div className="mb-2 inline-flex rounded-full border border-[#396155]/10 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#396155] backdrop-blur">
                Style enseignant actif
              </div>
              <p className="text-base font-semibold leading-tight text-gray-900">
                Ton style sert de base à toutes les appréciations générées.
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-gray-600">
                Matière, raccourcis et phrases préférées sont repris automatiquement.
              </p>
            </div>
            <button
              onClick={() => navigate("/style")}
              className="mt-3 rounded-full border border-[#396155]/15 bg-white/80 px-3 py-2 text-[11px] font-semibold text-[#396155] shadow-sm transition-colors hover:border-[#396155] hover:bg-[#396155]/5"
            >
              Modifier mon style
            </button>
          </div>

          <div className="relative mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/80 bg-white/85 px-3 py-3 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.1em] text-gray-500">
                <span>Matière</span>
                <button
                  onClick={() => navigate("/")}
                  className="rounded-full border border-gray-200 bg-white p-1 text-[#396155] transition-colors hover:border-[#396155]/30 hover:bg-[#396155]/5"
                  aria-label="Retour à l'accueil"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{styleProfile.subject || "Non renseignée"}</div>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/85 px-3 py-3 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.1em] text-gray-500">
                <span>Raccourcis</span>
                <button
                  onClick={() => navigate("/")}
                  className="rounded-full border border-gray-200 bg-white p-1 text-[#396155] transition-colors hover:border-[#396155]/30 hover:bg-[#396155]/5"
                  aria-label="Retour à l'accueil"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{styleProfile.favoriteWords.length}</div>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/85 px-3 py-3 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.1em] text-gray-500">
                <span>Phrases préférées</span>
                <button
                  onClick={() => navigate("/")}
                  className="rounded-full border border-gray-200 bg-white p-1 text-[#396155] transition-colors hover:border-[#396155]/30 hover:bg-[#396155]/5"
                  aria-label="Retour à l'accueil"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{styleProfile.favoritePhrases.length}</div>
            </div>
          </div>
        </div>

        <div className="mb-3">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full transition-all duration-300 ${isQuotaReached ? "bg-[#ff981d]" : "bg-[#396155]"}`}
              style={{ width: `${quotaProgressPercent}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-gray-600">
            <span>{quotaStatus.used} / {quotaStatus.limit} appels utilisés</span>
            {isQuotaReached ? (
              <span className="font-medium text-[#ff981d]">Limite atteinte, revenez demain après 8h.</span>
            ) : (
              <span>{quotaStatus.remaining} restant(s)</span>
            )}
          </div>
        </div>

        {/* General tone selector */}
        <div className="mb-3">
          {(isLoadingStudents || infoMessage) && (
            <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {isLoadingStudents ? "Chargement des élèves Pronote..." : infoMessage}
            </div>
          )}

          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700">Ton Général</label>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-medium text-gray-600">
              Applique un ton commun
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            <GeneralToneButton tone="bienveillant" label="Bienveillant" />
            <GeneralToneButton tone="neutre" label="Neutre" />
            <GeneralToneButton tone="pro" label="Pro" />
            <GeneralToneButton tone="alarmiste" label="Alarmiste" />
          </div>
          <button
            onClick={applyGeneralTone}
            className="text-xs text-[#396155] hover:text-[#2a4a40] underline"
          >
            Appliquer à tous les élèves
          </button>
        </div>
      </div>

      {/* Content - Student list */}
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-[#f8f8f9] px-3 py-3 shadow-sm">
            <div>
              <div className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Sélection</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">
                {selectedCount} élève{selectedCount > 1 ? "s" : ""} sélectionné{selectedCount > 1 ? "s" : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={checkAll}
                className="rounded-full border border-[#396155]/20 bg-white px-3 py-2 text-xs font-medium text-[#396155] transition-colors hover:border-[#396155] hover:bg-[#396155]/5"
              >
                Tout cocher
              </button>
              <button
                onClick={uncheckAll}
                className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
              >
                Décocher tout
              </button>
            </div>
          </div>
        </div>

        {students.map((student) => (
          <div key={student.id} className="border-b border-gray-200">
            {/* Student header */}
            <div className="p-4 bg-white hover:bg-gray-50">
              <div className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => toggleStudentSelected(student.id)}
                  className="flex-shrink-0"
                >
                  {student.isSelected ? (
                    <CheckSquare className="w-5 h-5 text-[#396155]" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{student.name}</span>
                  <span className="text-xs text-gray-500">Moy: {student.average}</span>
                </div>
              </div>

              {/* Expanded content */}
              {student.isSelected && (
                <div className="mt-4 space-y-4">
                  {/* Tone for this student */}
                  <div>
                    <label className="text-xs text-gray-700 mb-2 block">Ton pour cet élève</label>
                    <div className="flex flex-wrap gap-2">
                      <StudentToneButton studentId={student.id} tone="bienveillant" label="Bienveillant" />
                      <StudentToneButton studentId={student.id} tone="neutre" label="Neutre" />
                      <StudentToneButton studentId={student.id} tone="pro" label="Pro" />
                      <StudentToneButton studentId={student.id} tone="alarmiste" label="Alarmiste" />
                    </div>
                  </div>

                  {/* Shortcuts / quick actions */}
                  <div>
                    <label className="text-xs text-gray-700 mb-2 block">Raccourcis d'appréciation</label>
                    {styleProfile.favoriteWords.length === 0 ? (
                      <p className="text-[11px] text-gray-400">
                        Aucun raccourci configuré.{" "}
                        <button
                          onClick={() => navigate("/style")}
                          className="text-[#396155] underline"
                        >
                          En ajouter
                        </button>
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {styleProfile.favoriteWords.map((shortcut) => (
                          <button
                            key={shortcut}
                            onClick={() => toggleStudentPrinciple(student.id, shortcut)}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors border ${
                              student.selectedPrinciples.includes(shortcut)
                                ? "bg-[#396155] text-white border-[#396155]"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            {student.selectedPrinciples.includes(shortcut) ? (
                              <CheckSquare className="w-3 h-3 flex-shrink-0" />
                            ) : (
                              <Square className="w-3 h-3 flex-shrink-0" />
                            )}
                            <span className="text-[10px] text-left leading-tight">{shortcut}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Free text field */}
                  <div>
                    <label className="text-xs text-gray-700 mb-2 block">Notes personnelles (optionnel)</label>
                    <input
                      type="text"
                      value={student.freeText}
                      onChange={(e) => updateFreeText(student.id, e.target.value)}
                      placeholder="Ex: mention particulière, contexte..."
                      className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#396155] text-xs"
                    />
                  </div>

                  {/* Generated appreciation */}
                  {student.appreciation && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-700 mb-2 block">Appréciation générée <span className="text-[10px] text-[#396155] font-normal">(modifiable)</span></label>
                        <textarea
                          value={student.appreciation}
                          onChange={(e) => {
                            setStudents(prevStudents => prevStudents.map(s => 
                              s.id === student.id ? { ...s, appreciation: e.target.value } : s
                            ));
                          }}
                          className="w-full p-3 border border-[#396155]/40 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#396155] text-xs bg-white text-gray-900 cursor-text"
                          rows={4}
                        />
                      </div>
                      <button
                        onClick={() => void generateForStudent(student.id)}
                        disabled={isGenerating || isInserting || isLoadingStudents || isQuotaReached}
                        className="w-full bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded-lg border border-gray-200 transition-colors flex items-center justify-center gap-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Regénérer
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky bottom buttons */}
      {selectedCount > 0 && (
        <div className="sticky bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 p-4 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="rounded-3xl border border-[#396155]/12 bg-gradient-to-br from-white via-white to-[#396155]/6 p-3 shadow-[0_14px_30px_rgba(57,97,85,0.08)]">
            <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-[#f8f8f9] px-3 py-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Action rapide</div>
                <div className="mt-0.5 text-xs font-semibold text-gray-900">
                  {selectedCount} élève{selectedCount > 1 ? "s" : ""} prêt{selectedCount > 1 ? "s" : ""} pour la génération
                </div>
              </div>
              <div className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-gray-600 shadow-sm">
                {selectedWithoutAppreciationCount} sans appréciation
              </div>
            </div>

          <button
            onClick={handleGenerateClick}
            disabled={isGenerating || isInserting || isLoadingStudents || isQuotaReached}
            className="w-full rounded-2xl bg-[#396155] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#396155]/20 transition-colors hover:bg-[#2a4a40] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating
              ? "Génération en cours..."
              : `Générer ${selectedCount} appréciation${selectedCount > 1 ? "s" : ""}`}
          </button>
          {selectedWithAppreciationCount > 0 && (
            <>
              <button
                onClick={() => void insertAllToPlatform()}
                disabled={isGenerating || isInserting || isLoadingStudents}
                className="mt-2 w-full rounded-2xl bg-[#ff981d] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#e88a1a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isInserting
                  ? "Insertion en cours..."
                  : `Insérer ${selectedWithAppreciationCount} appréciation${selectedWithAppreciationCount > 1 ? "s" : ""} dans Pronote`}
              </button>

              <div className="mt-2 rounded-2xl border border-gray-200 bg-white px-3 py-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full transition-all duration-300 ${isQuotaReached ? "bg-[#ff981d]" : "bg-[#396155]"}`}
                    style={{ width: `${quotaProgressPercent}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-gray-600">
                  <span>{quotaStatus.used} / {quotaStatus.limit} appels/jour utilisés</span>
                  {isQuotaReached ? (
                    <span className="font-medium text-[#ff981d]">Limite atteinte</span>
                  ) : (
                    <span>{quotaStatus.remaining} restant(s)</span>
                  )}
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      )}

      {/* Confirmation modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 pb-4 px-4">
          <div className="bg-white rounded-xl p-5 shadow-xl w-full max-w-xs">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Générer les appréciations</h2>
            <p className="text-xs text-gray-600 mb-1">
              Vous allez générer <strong>{selectedCount}</strong> appréciation{selectedCount > 1 ? "s" : ""}.
            </p>
            {selectedWithAppreciationCount > 0 && (
              <p className="text-xs text-orange-600 mb-4">
                ⚠ {selectedWithAppreciationCount} appréciation{selectedWithAppreciationCount > 1 ? "s" : ""} existante{selectedWithAppreciationCount > 1 ? "s" : ""} seront écrasées.
              </p>
            )}
            {selectedWithAppreciationCount === 0 && <div className="mb-4" />}
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => { setShowConfirmModal(false); void generateAllSelected(); }}
                className="flex-1 py-2.5 rounded-lg bg-[#396155] text-white text-sm font-medium hover:bg-[#2a4a40] transition-colors"
              >
                Générer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
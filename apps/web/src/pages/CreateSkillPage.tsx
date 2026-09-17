import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Plus, Trash2, Wand2, Layers, Sliders, Bot, ArrowRight } from "lucide-react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";

interface SkillField {
  key: string;
  title: string;
}

interface DiscoveredModel {
  id: string;
  modelId: string;
  name: string;
  inputTypes: string[];
  outputTypes: string[];
  providerConfig?: { name: string };
}

const TEMPLATE_PRESETS = [
  {
    name: "Instagram Viral Reel & Post Crafter",
    description: "Takes trend research or a topic and generates viral Instagram captions, hooks, hashtags, and descriptive image/reel prompts.",
    capabilityKey: "text-generation",
    inputTypes: ["text", "query"],
    outputTypes: ["text", "json"],
    systemPrompt: `You are a world-class Instagram Creative Director and Social Copywriter.
Given the topic and trend context below:
1. Craft an irresistible 3-second hook
2. Write a high-converting, value-packed Instagram post caption with formatted emojis
3. Generate 7-10 trending niche hashtags
4. Output a photorealistic, high-contrast visual prompt for the image/reel generator

Topic: {{topic}}
Niche/Tone: {{tone}}
Web Research Brief: {{research_brief}}`,
    fields: [
      { key: "topic", title: "Content Topic / Angle" },
      { key: "tone", title: "Tone / Target Audience" },
      { key: "research_brief", title: "Trend Context (Optional)" },
    ],
  },
  {
    name: "Web Trend & News Intelligence",
    description: "Researches live web trends, news, and search sentiment in any domain.",
    capabilityKey: "web-search",
    inputTypes: ["query"],
    outputTypes: ["text"],
    systemPrompt: "Search the live web for breaking news and high-engagement topics.",
    fields: [
      { key: "query", title: "Search Query / Industry Niche" },
    ],
  },
  {
    name: "Social Media Image Prompt Optimizer",
    description: "Transforms plain social post concepts into stunning Midjourney/DALL-E 3 visual generation prompts.",
    capabilityKey: "text-generation",
    inputTypes: ["text"],
    outputTypes: ["text"],
    systemPrompt: `You are an expert prompt engineer for AI image models (DALL-E 3, Flux, SD-Turbo).
Transform the following post idea into an ultra-detailed, photorealistic, cinematic prompt with dramatic lighting, 8k resolution, and studio composition.

Idea: {{post_idea}}
Visual Style: {{style}}`,
    fields: [
      { key: "post_idea", title: "Post Idea" },
      { key: "style", title: "Visual Style (e.g., hyperrealistic, cyberpunk, minimalist)" },
    ],
  },
];

export function CreateSkillPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capabilityKey, setCapabilityKey] = useState("text-generation");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [inputTypes, setInputTypes] = useState<string[]>(["text"]);
  const [outputTypes, setOutputTypes] = useState<string[]>(["text"]);
  const [systemPrompt, setSystemPrompt] = useState("You are an expert AI. Your task is to...\n\nTopic: {{topic}}");
  const [fields, setFields] = useState<SkillField[]>([{ key: "topic", title: "Topic" }]);
  const [humanGate, setHumanGate] = useState(false);

  const { data: models } = useQuery({
    queryKey: ["all-models"],
    queryFn: () => api.get<DiscoveredModel[]>("/models"),
  });

  const createSkill = useMutation({
    mutationFn: async () => {
      const properties: Record<string, any> = {};
      const required: string[] = [];

      fields.forEach((f) => {
        if (!f.key.trim()) return;
        properties[f.key] = { type: "string", title: f.title || f.key };
        required.push(f.key);
      });

      const inputSchema = {
        type: "object",
        properties,
        required,
      };

      return api.post("/agents/custom", {
        name,
        description,
        capabilityKey,
        modelId: selectedModelId || undefined,
        inputTypes,
        outputTypes,
        systemPrompt,
        inputSchema,
        humanGate,
      });
    },
    onSuccess: () => {
      toast.success(`Agent "${name}" created and registered!`);
      navigate("/agents");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const addField = () => setFields([...fields, { key: "", title: "" }]);
  const removeField = (index: number) => setFields(fields.filter((_, i) => i !== index));
  const updateField = (index: number, updates: Partial<SkillField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const applyPreset = (preset: (typeof TEMPLATE_PRESETS)[0]) => {
    setName(preset.name);
    setDescription(preset.description);
    setCapabilityKey(preset.capabilityKey);
    setInputTypes(preset.inputTypes);
    setOutputTypes(preset.outputTypes);
    setSystemPrompt(preset.systemPrompt);
    setFields(preset.fields);
    toast.info(`Loaded preset: ${preset.name}`);
  };

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6">
      <PageHeader
        title="Create Custom AI Agent / Skill"
        description="Design a dynamic agent served straight from the database. Bind it to discovered models, set input/output modalities, and configure its system prompt."
        actions={
          <Button
            onClick={() => createSkill.mutate()}
            disabled={!name || !systemPrompt || createSkill.isPending}
            className="bg-primary hover:bg-primary/90 shadow-md"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Save & Publish Agent
          </Button>
        }
      />

      {/* Preset Recipes */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Start Recipes:</span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TEMPLATE_PRESETS.map((p) => (
            <Card
              key={p.name}
              glass
              className="p-3.5 hover:border-primary/50 transition-all cursor-pointer flex flex-col justify-between"
              onClick={() => applyPreset(p)}
            >
              <div>
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  <Bot className="h-4 w-4 text-primary" /> {p.name}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
              </div>
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/40 text-[11px] text-primary">
                <span>Load Recipe</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card glass>
            <CardContent className="space-y-4 pt-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Agent Name</Label>
                  <Input
                    placeholder="e.g., Instagram Reel Copywriter"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="font-medium text-lg h-12"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="What does this agent accomplish?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Capability</Label>
                  <Select value={capabilityKey} onChange={(e) => setCapabilityKey(e.target.value)}>
                    <option value="text-generation">Text & LLM Generation</option>
                    <option value="web-search">Web Search & Trends</option>
                    <option value="image-generation">Image Generation</option>
                    <option value="video-generation">Video Generation</option>
                  </Select>
                </div>

                <div>
                  <Label>Bound Base Model (Optional)</Label>
                  <Select value={selectedModelId} onChange={(e) => setSelectedModelId(e.target.value)}>
                    <option value="">Default provider model</option>
                    {models?.map((m) => (
                      <option key={m.id} value={m.modelId}>
                        {m.name} ({m.providerConfig?.name || "model"})
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="md:col-span-2 pt-3 border-t border-border/40">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={humanGate}
                      onChange={(e) => setHumanGate(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="text-sm font-medium text-foreground">Human-in-the-Loop Review Gate</span>
                      <p className="text-xs text-muted-foreground">
                        When enabled, pipeline runs pause when this agent completes, requiring manual approval and review notes before advancing to the next step.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card glass className="border-primary/20">
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold text-primary">System Prompt Template</h3>
                </div>
                <Badge variant="outline" className="text-xs font-mono">Dynamic Variables</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Inject runtime inputs or upstream pipeline artifacts using double curly braces (e.g. <code>{"{{topic}}"}</code>, <code>{"{{research_brief}}"}</code>).
              </p>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="font-mono text-sm h-64 bg-background/50 leading-relaxed"
                placeholder="You are an expert AI..."
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Modalities Configuration */}
          <Card glass>
            <CardContent className="space-y-4 pt-5">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> Modality Types
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <Label className="text-xs">Supported Input Types</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {["text", "query", "image", "audio", "video", "json"].map((t) => {
                      const active = inputTypes.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            setInputTypes(active ? inputTypes.filter((x) => x !== t) : [...inputTypes, t])
                          }
                          className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                            active
                              ? "bg-primary/20 border-primary text-primary"
                              : "border-border text-muted-foreground hover:bg-secondary/40"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Produced Output Types</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {["text", "image", "audio", "video", "json"].map((t) => {
                      const active = outputTypes.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            setOutputTypes(active ? outputTypes.filter((x) => x !== t) : [...outputTypes, t])
                          }
                          className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                            active
                              ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                              : "border-border text-muted-foreground hover:bg-secondary/40"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Fields / Inputs */}
          <Card glass>
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Inputs & Parameters</h3>
                <Button variant="outline" size="sm" onClick={addField}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Define the parameters required by this agent when wired into workflows.
              </p>

              <div className="space-y-2.5 mt-3">
                {fields.map((field, i) => (
                  <div key={i} className="flex flex-col gap-1.5 p-2.5 border border-border/60 rounded-lg bg-background/50">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono font-medium text-muted-foreground uppercase">Variable {i + 1}</span>
                      <button onClick={() => removeField(i)} className="text-destructive/70 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Input
                      placeholder="Variable Key (e.g. topic)"
                      value={field.key}
                      onChange={(e) =>
                        updateField(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })
                      }
                      className="h-7 text-xs font-mono"
                    />
                    <Input
                      placeholder="Label Title (e.g. Content Niche)"
                      value={field.title}
                      onChange={(e) => updateField(i, { title: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


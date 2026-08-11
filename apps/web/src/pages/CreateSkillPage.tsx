import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Plus, Trash2, Wand2 } from "lucide-react";
import { api } from "../api/client.js";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";

interface SkillField {
  key: string;
  title: string;
}

export function CreateSkillPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("You are an expert AI. Your task is to...\n\nTopic: {{topic}}");
  const [fields, setFields] = useState<SkillField[]>([{ key: "topic", title: "Topic" }]);

  const createSkill = useMutation({
    mutationFn: async () => {
      // Build JSON Schema from the fields
      const properties: Record<string, any> = {};
      const required: string[] = [];
      
      fields.forEach(f => {
        if (!f.key.trim()) return;
        properties[f.key] = { type: "string", title: f.title || f.key };
        required.push(f.key);
      });

      const inputSchema = {
        type: "object",
        properties,
        required
      };

      return api.post("/agents/custom", {
        name,
        description,
        systemPrompt,
        inputSchema
      });
    },
    onSuccess: () => {
      toast.success("Skill created successfully!");
      navigate("/agents");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const addField = () => setFields([...fields, { key: "", title: "" }]);
  const removeField = (index: number) => setFields(fields.filter((_, i) => i !== index));
  const updateField = (index: number, updates: Partial<SkillField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <PageHeader 
        title="Create a New Skill" 
        description="Design a custom AI skill without writing any code. Define the inputs and tell the AI what to do."
        actions={
          <Button 
            onClick={() => createSkill.mutate()} 
            disabled={!name || !systemPrompt || createSkill.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Save Skill
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card glass>
            <CardContent className="space-y-4 pt-5">
              <div>
                <Label>Skill Name</Label>
                <Input 
                  placeholder="e.g., Viral Reel Scriptwriter" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="font-medium text-lg h-12"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input 
                  placeholder="What does this skill do?" 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                />
              </div>
            </CardContent>
          </Card>

          <Card glass className="border-primary/20">
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-center gap-2 mb-2">
                <Wand2 className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-primary">System Prompt</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                This is the core instruction for the AI. You can inject the inputs you define below by wrapping their keys in double curly braces, like <code>{"{{topic}}"}</code>.
              </p>
              <Textarea 
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                className="font-mono text-sm h-64 bg-background/50"
                placeholder="You are an expert..."
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card glass>
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Inputs (Form Fields)</h3>
                <Button variant="outline" size="sm" onClick={addField}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Define the data this skill needs. These will become form fields when someone runs it.
              </p>

              <div className="space-y-3 mt-4">
                {fields.map((field, i) => (
                  <div key={i} className="flex flex-col gap-2 p-3 border border-border/50 rounded-lg bg-background/50">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium uppercase text-muted-foreground">Field {i+1}</span>
                      <button onClick={() => removeField(i)} className="text-destructive/70 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <Input 
                      placeholder="Variable Key (e.g., topic)" 
                      value={field.key} 
                      onChange={e => updateField(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                      className="h-8 text-xs font-mono"
                    />
                    <Input 
                      placeholder="Display Title (e.g., Video Topic)" 
                      value={field.title} 
                      onChange={e => updateField(i, { title: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
                {fields.length === 0 && (
                  <div className="text-center p-4 border border-dashed rounded text-sm text-muted-foreground">
                    No inputs defined.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

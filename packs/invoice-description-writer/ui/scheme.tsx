"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mono } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { useJson } from "@/lib/use-json";
import { invoiceDescriptionWriterPack as pack } from "@/packs/invoice-description-writer/module";
import type { SchemePayload } from "@/packs/invoice-description-writer/lib/types";
import { errorText } from "./format";

export function Scheme() {
  const { data, error } = useJson<SchemePayload>(`${pack.apiBase}/scheme`);
  if (error) return <p className="text-sm text-risk">{errorText(error)}</p>;
  if (!data) return <p className="text-muted-foreground">Loading the house description order.</p>;
  return (
    <div>
      <ScreenHeader screen="invoice-description-writer/the-house-description-order" title="The house description order" />
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        Every description is written in this order. Nothing here is edited in the demo. The service words are shortened first when the text passes{" "}
        {data.max_length} characters.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.templates.map((t) => (
          <Card key={t.template_id} data-testid={`scheme-${t.template_id}`}>
            <CardHeader>
              <CardTitle>{t.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                <Mono>{t.template}</Mono>
              </pre>
              <ul className="space-y-1">
                {t.segments.map((s) => (
                  <li key={s.placeholder}>
                    <Mono>{s.placeholder}</Mono>: {s.when_missing ? `when missing, ${s.when_missing}` : "left out when the invoice does not print it"}
                  </li>
                ))}
              </ul>
              <p data-testid={`scheme-example-${t.template_id}`} className="rounded-md border bg-background p-3">
                Example from <Mono>{t.example.invoice_id}</Mono>: {t.example.text}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

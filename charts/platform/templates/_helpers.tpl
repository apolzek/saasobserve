{{- define "platform.labels" -}}
app.kubernetes.io/managed-by: saasobserve
app.kubernetes.io/part-of: platform
{{- end -}}

{{- define "platform.resources" -}}
{{- $r := index .Values.resources .component -}}
{{- if $r -}}
{{ $r | toYaml }}
{{- else -}}
{{ .Values.resources.default | toYaml }}
{{- end -}}
{{- end -}}

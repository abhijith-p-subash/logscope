# Exporting logs from AWS CloudWatch

logscope reads log files you download from AWS. It does **not** connect to AWS
itself (on purpose — that keeps it credential-free and safe to run offline). So the
first step is getting a file out of CloudWatch.

Any of the formats below work — logscope auto-detects them.

---

## Recommended: export from CloudWatch Logs Insights as JSON

**JSON is the best format** — it keeps the structure of your logs intact.

1. In the AWS Console, open **CloudWatch → Logs → Logs Insights**.
2. Select your log group(s) and time range.
3. Run your query (even a simple `fields @timestamp, @message | sort @timestamp` works).
4. Click **Export results → Download as JSON** (or copy the results).
5. Save the file into the folder logscope is watching (e.g. your Downloads).

The file appears in logscope within a second.

> **JSON vs CSV:** CSV is supported but second-class — it flattens nested data and
> wraps your real payload in an escaped string inside a cell. Prefer **JSON** when
> you have the choice.

---

## Also supported

| Format | Where it comes from | Notes |
|--------|--------------------|-------|
| **JSON** | Insights "Download as JSON" | ✅ Best. Full structure preserved. |
| **NDJSON** | One JSON object per line | ✅ Great. Common for streamed/log-forwarder output. |
| **CSV** | Insights "Download as CSV" | ⚠️ Works, but nesting is flattened. |
| **Insights `results` shape** | Copied Insights API response | ✅ Auto-detected. |
| **Plain text / `.log`** | Raw log dumps | Shown as-is; still stitched & searchable. |

Supported file extensions: `.json`, `.ndjson`, `.csv`, `.txt`, `.log`.

---

## ⚠️ The 10,000-row limit — read this

CloudWatch Logs Insights **caps exports at 10,000 rows.** If your export has
*exactly* 10,000 rows, it almost certainly got **cut off** and you're missing data.

logscope will **warn you** when it detects this. If you see that warning:

- **Narrow your time range** and export again in smaller windows, or
- **Add filters** to your Insights query so fewer rows come back.

Showing partial data silently is worse than knowing it's incomplete — that's why
logscope flags it.

---

## Why not just connect logscope to AWS directly?

Deliberate design choice. Reading downloaded files means:

- **No AWS credentials** to manage, no IAM permissions, no API cost or rate limits.
- **A trivial security review** — "it reads local files and opens no network
  connections" can be verified in 30 seconds by running it with Wi-Fi off.
- **Your client data never leaves your laptop.**

The trade-off is one manual download step, and the 10,000-row cap above.

---

Next: **[User Guide](./user-guide.md)** — what to do once your logs are open.

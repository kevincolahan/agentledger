import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export function reportR2Key(orgId: string, reportId: string): string {
  return `reports/${orgId}/${reportId}.pdf`;
}

export async function uploadReportPdf(
  orgId: string,
  reportId: string,
  buffer: Buffer
): Promise<{ key: string; size: number }> {
  const client = getR2Client();
  const key = reportR2Key(orgId, reportId);

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
      ContentDisposition: `attachment; filename="agentledger-audit-${reportId}.pdf"`,
      Metadata: {
        orgId,
        reportId,
        generatedAt: new Date().toISOString(),
      },
    })
  );

  return { key, size: buffer.length };
}

export async function getReportDownloadUrl(key: string): Promise<string> {
  const client = getR2Client();

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    }),
    { expiresIn: 3600 } // 1 hour
  );
}

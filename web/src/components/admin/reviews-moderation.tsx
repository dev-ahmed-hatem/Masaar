"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, App, Button, Empty, Rate, Select, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { listReviews, republishReview, unpublishReview, type Review } from "@/lib/reviews";

type Dict = Dictionary["adminReviews"];

const { Title, Paragraph } = Typography;

export default function ReviewsModeration({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const [published, setPublished] = useState<string>("");
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listReviews({ published: published || undefined })
      .then((data) => setRows(data.results))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : dict.loadError);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [published, dict.loadError]);

  useEffect(() => load(), [load]);

  async function toggle(review: Review) {
    try {
      if (review.is_published) {
        await unpublishReview(review.id);
        message.success(dict.unpublished);
      } else {
        await republishReview(review.id);
        message.success(dict.republished);
      }
      load();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.actionError);
    }
  }

  const columns: ColumnsType<Review> = [
    { title: dict.colTeacher, dataIndex: "teacher_name", key: "teacher" },
    { title: dict.colStudent, dataIndex: "student_name", key: "student" },
    {
      title: dict.colRating,
      key: "rating",
      render: (_, r) => <Rate disabled value={r.rating} style={{ fontSize: 14 }} />,
    },
    {
      title: dict.colReview,
      key: "text",
      render: (_, r) => <span className="line-clamp-2 max-w-md opacity-80">{r.text || "—"}</span>,
    },
    {
      title: dict.colStatus,
      key: "status",
      render: (_, r) => (
        <Tag color={r.is_published ? "green" : "default"}>
          {r.is_published ? dict.published : dict.hidden}
        </Tag>
      ),
    },
    {
      title: "",
      key: "action",
      render: (_, r) => (
        <Button size="small" danger={r.is_published} onClick={() => toggle(r)}>
          {r.is_published ? dict.unpublish : dict.republish}
        </Button>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-5">
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          {dict.title}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {dict.intro}
        </Paragraph>
      </div>

      <label className="flex flex-col gap-1 text-xs" style={{ maxWidth: 220 }}>
        <span className="opacity-60">{dict.filterPublished}</span>
        <Select
          value={published}
          onChange={setPublished}
          options={[
            { value: "", label: dict.all },
            { value: "true", label: dict.publishedOnly },
            { value: "false", label: dict.hiddenOnly },
          ]}
        />
      </label>

      {error ? (
        <Alert type="error" message={error} showIcon />
      ) : (
        <Table<Review>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          locale={{ emptyText: <Empty description={dict.empty} /> }}
          pagination={{ showTotal: () => dict.resultsCount.replace("{count}", String(rows.length)) }}
        />
      )}
    </section>
  );
}

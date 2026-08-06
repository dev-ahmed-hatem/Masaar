"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, App, Button, Empty, Rate, Select, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { FilterField, PageHeader, Panel } from "@/components/ui";
import { listReviews, republishReview, unpublishReview, type Review } from "@/lib/reviews";

type Dict = Dictionary["adminReviews"];

export default function ReviewsModeration({ dict }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const [published, setPublished] = useState<string>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listReviews({ published: published || undefined, page, page_size: 20 })
      .then((data) => {
        setRows(data.results);
        setTotal(data.count);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : dict.loadError);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [published, page, dict.loadError]);

  useEffect(() => load(), [load]);

  useEffect(() => setPage(1), [published]);

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

  const filters = (
    <FilterField label={dict.filterPublished}>
      <Select
        value={published}
        onChange={setPublished}
        style={{ width: 220 }}
        options={[
          { value: "", label: dict.all },
          { value: "true", label: dict.publishedOnly },
          { value: "false", label: dict.hiddenOnly },
        ]}
      />
    </FilterField>
  );

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={dict.title} subtitle={dict.intro} />

      {error ? (
        <Alert type="error" message={error} showIcon />
      ) : (
        <Panel toolbar={filters}>
          <Table<Review>
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={loading}
            locale={{ emptyText: <Empty description={dict.empty} /> }}
            pagination={{
              current: page,
              pageSize: 20,
              total,
              showSizeChanger: false,
              onChange: setPage,
              showTotal: () => dict.resultsCount.replace("{count}", String(total)),
            }}
          />
        </Panel>
      )}
    </section>
  );
}

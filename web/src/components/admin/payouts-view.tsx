"use client";

import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  App,
  Button,
  DatePicker,
  Drawer,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { FilterField, PageHeader, Panel } from "@/components/ui";
import {
  generateCycle,
  getCycle,
  listCycles,
  markItemPaid,
  type CycleStatus,
  type ItemStatus,
  type PayoutCycle,
  type PayoutCycleDetail,
  type PayoutItem,
} from "@/lib/payouts";

type Dict = Dictionary["adminPayouts"];

const { Title } = Typography;

const CYCLE_COLORS: Record<CycleStatus, string> = { OPEN: "gold", PROCESSING: "blue", PAID: "green" };
const ITEM_COLORS: Record<ItemStatus, string> = { PENDING: "gold", PAID: "green" };
const MARKETS = ["EG", "SA"];

function money(minor: number): string {
  return (minor / 100).toFixed(2);
}

export default function PayoutsView({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const [market, setMarket] = useState("EG");
  const [start, setStart] = useState<dayjs.Dayjs | null>(null);
  const [end, setEnd] = useState<dayjs.Dayjs | null>(null);
  const [generating, setGenerating] = useState(false);

  const [rows, setRows] = useState<PayoutCycle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<PayoutCycleDetail | null>(null);
  const [refs, setRefs] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listCycles({})
      .then((data) => setRows(data.results))
      .catch((err) => setError(err instanceof ApiError ? err.message : dict.loadError))
      .finally(() => setLoading(false));
  }, [dict.loadError]);

  useEffect(() => load(), [load]);

  async function generate() {
    if (!start || !end) return;
    setGenerating(true);
    try {
      await generateCycle({
        market,
        period_start: start.format("YYYY-MM-DD"),
        period_end: end.format("YYYY-MM-DD"),
      });
      message.success(dict.generated);
      setStart(null);
      setEnd(null);
      load();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.actionError);
    } finally {
      setGenerating(false);
    }
  }

  async function openCycle(id: number) {
    setSelected(await getCycle(id));
  }

  async function pay(item: PayoutItem) {
    try {
      await markItemPaid(item.id, refs[item.id] ?? "");
      message.success(dict.marked);
      if (selected) setSelected(await getCycle(selected.id));
      load();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.actionError);
    }
  }

  const cycleColumns: ColumnsType<PayoutCycle> = [
    {
      title: dict.colPeriod,
      key: "period",
      render: (_, c) => `${c.period_start} → ${c.period_end}`,
    },
    { title: dict.colMarket, dataIndex: "market", key: "market" },
    { title: dict.colItems, dataIndex: "items_count", key: "items" },
    { title: dict.colTotal, key: "total", render: (_, c) => money(c.total_minor) },
    {
      title: dict.colStatus,
      key: "status",
      render: (_, c) => (
        <Tag color={CYCLE_COLORS[c.status]}>{dict[`status${c.status}` as keyof Dict] as string}</Tag>
      ),
    },
  ];

  const itemColumns: ColumnsType<PayoutItem> = [
    { title: dict.colTeacher, dataIndex: "teacher_name", key: "teacher" },
    { title: dict.colLessons, dataIndex: "lessons_count", key: "lessons" },
    { title: dict.colAmount, key: "amount", render: (_, i) => i.amount_display },
    {
      title: dict.colStatus,
      key: "status",
      render: (_, i) => (
        <Tag color={ITEM_COLORS[i.status]}>{dict[`item${i.status}` as keyof Dict] as string}</Tag>
      ),
    },
    {
      title: "",
      key: "action",
      render: (_, i) =>
        i.status === "PENDING" ? (
          <Space.Compact>
            <Input
              size="small"
              placeholder={dict.reference}
              value={refs[i.id] ?? ""}
              onChange={(e) => setRefs((p) => ({ ...p, [i.id]: e.target.value }))}
              style={{ width: 140 }}
            />
            <Button size="small" type="primary" onClick={() => pay(i)}>
              {dict.markPaid}
            </Button>
          </Space.Compact>
        ) : (
          <span className="text-xs opacity-60">{i.reference || "—"}</span>
        ),
    },
  ];

  const filters = (
    <>
      <FilterField label={dict.market}>
        <Select value={market} onChange={setMarket} style={{ width: 120 }} options={MARKETS.map((m) => ({ value: m, label: m }))} />
      </FilterField>
      <FilterField label={dict.periodStart}>
        <DatePicker value={start} onChange={setStart} />
      </FilterField>
      <FilterField label={dict.periodEnd}>
        <DatePicker value={end} onChange={setEnd} />
      </FilterField>
      <Button type="primary" loading={generating} disabled={!start || !end} onClick={generate}>
        {dict.generate}
      </Button>
    </>
  );

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={dict.title} subtitle={dict.intro} />

      {error ? (
        <Alert type="error" message={error} showIcon />
      ) : (
        <Panel toolbar={filters}>
          <Table<PayoutCycle>
            rowKey="id"
            columns={cycleColumns}
            dataSource={rows}
            loading={loading}
            onRow={(c) => ({ onClick: () => openCycle(c.id), style: { cursor: "pointer" } })}
            locale={{ emptyText: <Empty description={dict.empty} /> }}
            pagination={{ showTotal: () => dict.resultsCount.replace("{count}", String(rows.length)) }}
          />
        </Panel>
      )}

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        width={640}
        placement={locale === "ar" ? "left" : "right"}
        title={selected ? `${selected.period_start} → ${selected.period_end}` : ""}
      >
        {selected && (
          <>
            <Title level={5}>{dict.itemsTitle}</Title>
            <Table<PayoutItem>
              rowKey="id"
              size="small"
              columns={itemColumns}
              dataSource={selected.items}
              pagination={false}
              locale={{ emptyText: <Empty description={dict.noItems} /> }}
            />
          </>
        )}
      </Drawer>
    </section>
  );
}

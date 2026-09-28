"use client";

import { useCallback, useEffect, useState } from "react";
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tabs } from "antd";
import type { ColumnsType } from "antd/es/table";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import { stageSelectOptions } from "@/components/catalog/stage-options";
import { Badge } from "@/components/ui/badge";
import {
  catalogAdmin,
  catalogName,
  trackWord,
  type CatalogSubject,
  type ChildKind,
  type Stage,
  type StageGroup,
  type StageSubject,
  type Track,
} from "@/lib/catalog";

type Dict = Dictionary["adminCatalog"];

export default function CatalogView({ dict, locale }: { dict: Dict; locale: Locale }) {
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={dict.title} subtitle={dict.intro} />
      <Tabs
        items={[
          { key: "groups", label: dict.tabGroups, children: <GroupsTab dict={dict} /> },
          { key: "stages", label: dict.tabStages, children: <StagesTab dict={dict} locale={locale} /> },
          { key: "tracks", label: dict.tabTracks, children: <TracksTab dict={dict} locale={locale} /> },
          { key: "subjects", label: dict.tabSubjects, children: <SubjectsTab dict={dict} locale={locale} /> },
          { key: "assign", label: dict.tabAssignments, children: <AssignmentsTab dict={dict} locale={locale} /> },
        ]}
      />
    </section>
  );
}

function useFail(dict: Dict) {
  const { message } = App.useApp();
  return useCallback(
    (err: unknown) => message.error(err instanceof ApiError ? err.message : dict.actionError),
    [message, dict.actionError],
  );
}

const CHILD_KIND_LABELS: Record<ChildKind, (d: Dict) => string> = {
  NONE: (d) => d.childNone,
  BRANCH: (d) => d.childBranch,
  FACULTY: (d) => d.childFaculty,
  GROUPED: (d) => d.childGrouped,
};

function childKindOptions(dict: Dict) {
  return (Object.keys(CHILD_KIND_LABELS) as ChildKind[]).map((value) => ({
    value,
    label: CHILD_KIND_LABELS[value](dict),
  }));
}

// --- Stage groups ----------------------------------------------------------
// A display-only header over sibling stages. Nothing is priced or booked by a
// group; it only decides how the stage list is chunked in the UI.

function GroupsTab({ dict }: { dict: Dict }) {
  const { message } = App.useApp();
  const fail = useFail(dict);
  const [rows, setRows] = useState<StageGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StageGroup | "new" | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(() => {
    setLoading(true);
    catalogAdmin.listGroups().then(setRows).catch(fail).finally(() => setLoading(false));
  }, [fail]);
  useEffect(load, [load]);

  function open(row: StageGroup | "new") {
    setEditing(row);
    form.setFieldsValue(
      row === "new" ? { code: "", name_en: "", name_ar: "", order: 0, is_active: true } : row,
    );
  }

  async function save() {
    const values = await form.validateFields();
    try {
      if (editing === "new") await catalogAdmin.createGroup(values);
      else if (editing) await catalogAdmin.updateGroup(editing.id, values);
      message.success(dict.saved);
      setEditing(null);
      load();
    } catch (err) {
      fail(err);
    }
  }

  async function remove(id: number) {
    try {
      await catalogAdmin.deleteGroup(id);
      load();
    } catch (err) {
      // A group still assigned to a stage comes back as a 409 with a message.
      fail(err);
    }
  }

  const columns: ColumnsType<StageGroup> = [
    { title: dict.code, dataIndex: "code" },
    { title: dict.nameEn, dataIndex: "name_en" },
    { title: dict.nameAr, dataIndex: "name_ar" },
    { title: dict.order, dataIndex: "order" },
    {
      title: "",
      key: "actions",
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => open(row)}>{dict.edit}</Button>
          <Popconfirm title={dict.confirmDelete} onConfirm={() => remove(row.id)}>
            <Button size="small" danger>{dict.remove}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <Button type="primary" className="self-start" onClick={() => open("new")}>{dict.newGroup}</Button>
      <p className="t-caption text-ink-faint">{dict.groupOrderHint}</p>
      <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} size="middle" />
      <Modal open={editing != null} onCancel={() => setEditing(null)} onOk={save} title={editing === "new" ? dict.newGroup : dict.edit} okText={dict.save}>
        <Form form={form} layout="vertical" requiredMark={false} className="pt-2">
          <Form.Item name="code" label={dict.code} rules={[{ required: true, whitespace: true }]}>
            <Input placeholder="INTERNATIONAL" />
          </Form.Item>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Form.Item name="name_en" label={dict.nameEn} rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="name_ar" label={dict.nameAr} rules={[{ required: true }]}><Input dir="rtl" /></Form.Item>
          </div>
          <Form.Item name="order" label={dict.order}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="is_active" label={dict.active} valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// --- Stages ----------------------------------------------------------------

function StagesTab({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const fail = useFail(dict);
  const [rows, setRows] = useState<Stage[]>([]);
  const [groups, setGroups] = useState<StageGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Stage | "new" | null>(null);
  const [form] = Form.useForm();
  // Only a GROUPED stage names its own track, so the label fields follow it.
  const childKind = Form.useWatch<ChildKind>("child_kind", form);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([catalogAdmin.listStages(), catalogAdmin.listGroups()])
      .then(([stages, stageGroups]) => {
        setRows(stages);
        setGroups(stageGroups);
      })
      .catch(fail)
      .finally(() => setLoading(false));
  }, [fail]);
  useEffect(load, [load]);

  function open(row: Stage | "new") {
    setEditing(row);
    form.setFieldsValue(
      row === "new"
        ? {
            code: "", name_en: "", name_ar: "", group_id: null, child_kind: "NONE",
            child_label_en: "", child_label_ar: "", order: 0, is_active: true,
          }
        // The group reads back nested but writes by id.
        : { ...row, group_id: row.group?.id ?? null },
    );
  }

  async function save() {
    const values = await form.validateFields();
    try {
      if (editing === "new") await catalogAdmin.createStage(values);
      else if (editing) await catalogAdmin.updateStage(editing.id, values);
      message.success(dict.saved);
      setEditing(null);
      load();
    } catch (err) {
      fail(err);
    }
  }

  async function remove(id: number) {
    try {
      await catalogAdmin.deleteStage(id);
      load();
    } catch (err) {
      fail(err);
    }
  }

  const columns: ColumnsType<Stage> = [
    { title: dict.code, dataIndex: "code" },
    { title: dict.nameEn, dataIndex: "name_en" },
    { title: dict.nameAr, dataIndex: "name_ar" },
    {
      title: dict.group,
      key: "group",
      render: (_, row) => (row.group ? catalogName(row.group, locale) : "—"),
    },
    {
      title: dict.childKind,
      dataIndex: "child_kind",
      // A custom grouping shows the name the moderator gave it, not "Custom".
      render: (k: ChildKind, row) =>
        k === "GROUPED" ? trackWord(row, dict, locale) : CHILD_KIND_LABELS[k](dict),
    },
    {
      title: dict.active,
      dataIndex: "is_active",
      render: (a: boolean) => (a ? <Badge variant="success" size="sm">{dict.active}</Badge> : <Badge size="sm">{dict.inactive}</Badge>),
    },
    {
      title: "",
      key: "actions",
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => open(row)}>{dict.edit}</Button>
          <Popconfirm title={dict.confirmDelete} onConfirm={() => remove(row.id)}>
            <Button size="small" danger>{dict.remove}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <Button type="primary" className="self-start" onClick={() => open("new")}>{dict.newStage}</Button>
      <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} size="middle" />
      <Modal open={editing != null} onCancel={() => setEditing(null)} onOk={save} title={editing === "new" ? dict.newStage : dict.edit} okText={dict.save}>
        <Form form={form} layout="vertical" requiredMark={false} className="pt-2">
          <Form.Item name="code" label={dict.code} rules={[{ required: true, whitespace: true }]}>
            <Input placeholder="PRIMARY" />
          </Form.Item>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Form.Item name="name_en" label={dict.nameEn} rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="name_ar" label={dict.nameAr} rules={[{ required: true }]}><Input dir="rtl" /></Form.Item>
          </div>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Form.Item name="child_kind" label={dict.childKind}><Select options={childKindOptions(dict)} /></Form.Item>
            <Form.Item name="order" label={dict.order}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
          </div>
          {childKind === "GROUPED" ? (
            <div className="grid gap-x-3 sm:grid-cols-2">
              <Form.Item name="child_label_en" label={dict.childLabelEn} rules={[{ required: true, whitespace: true }]} extra={dict.childLabelHint}>
                <Input placeholder="Curriculum" />
              </Form.Item>
              <Form.Item name="child_label_ar" label={dict.childLabelAr} rules={[{ required: true, whitespace: true }]}>
                <Input dir="rtl" />
              </Form.Item>
            </div>
          ) : null}
          <Form.Item name="group_id" label={dict.group} extra={dict.groupOrderHint}>
            <Select
              allowClear
              placeholder={dict.noGroup}
              options={groups.map((g) => ({ value: g.id, label: catalogName(g, locale) }))}
            />
          </Form.Item>
          <Form.Item name="is_active" label={dict.active} valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// --- Tracks ----------------------------------------------------------------

function TracksTab({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const fail = useFail(dict);
  const [stages, setStages] = useState<Stage[]>([]);
  const [stageId, setStageId] = useState<number | undefined>();
  const [rows, setRows] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Track | "new" | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    catalogAdmin.listStages().then((s) => {
      setStages(s);
      setStageId((prev) => prev ?? s.find((x) => x.child_kind !== "NONE")?.id);
    }).catch(fail);
  }, [fail]);

  const load = useCallback(() => {
    if (!stageId) return;
    setLoading(true);
    catalogAdmin.listTracks(stageId).then(setRows).catch(fail).finally(() => setLoading(false));
  }, [stageId, fail]);
  useEffect(load, [load]);

  function open(row: Track | "new") {
    setEditing(row);
    form.setFieldsValue(row === "new" ? { name_en: "", name_ar: "", order: 0, is_active: true } : row);
  }

  async function save() {
    const values = await form.validateFields();
    try {
      if (editing === "new") await catalogAdmin.createTrack({ ...values, vertical: stageId! });
      else if (editing) await catalogAdmin.updateTrack(editing.id, values);
      message.success(dict.saved);
      setEditing(null);
      load();
    } catch (err) {
      fail(err);
    }
  }

  async function remove(id: number) {
    try { await catalogAdmin.deleteTrack(id); load(); } catch (err) { fail(err); }
  }

  const columns: ColumnsType<Track> = [
    { title: dict.nameEn, dataIndex: "name_en" },
    { title: dict.nameAr, dataIndex: "name_ar" },
    { title: dict.order, dataIndex: "order" },
    { title: dict.active, dataIndex: "is_active", render: (a: boolean) => (a ? <Badge variant="success" size="sm">{dict.active}</Badge> : <Badge size="sm">{dict.inactive}</Badge>) },
    {
      title: "",
      key: "actions",
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => open(row)}>{dict.edit}</Button>
          <Popconfirm title={dict.confirmDelete} onConfirm={() => remove(row.id)}>
            <Button size="small" danger>{dict.remove}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          style={{ minWidth: 220 }}
          value={stageId}
          onChange={setStageId}
          placeholder={dict.selectStage}
          options={stageSelectOptions(stages, locale)}
        />
        <Button type="primary" disabled={!stageId} onClick={() => open("new")}>{dict.newTrack}</Button>
      </div>
      <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} size="middle" />
      <Modal open={editing != null} onCancel={() => setEditing(null)} onOk={save} title={editing === "new" ? dict.newTrack : dict.edit} okText={dict.save}>
        <Form form={form} layout="vertical" requiredMark={false} className="pt-2">
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Form.Item name="name_en" label={dict.nameEn} rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="name_ar" label={dict.nameAr} rules={[{ required: true }]}><Input dir="rtl" /></Form.Item>
          </div>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Form.Item name="order" label={dict.order}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
            <Form.Item name="is_active" label={dict.active} valuePropName="checked"><Switch /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

// --- Subjects --------------------------------------------------------------

function SubjectsTab({ dict }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const fail = useFail(dict);
  const [rows, setRows] = useState<CatalogSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CatalogSubject | "new" | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(() => {
    setLoading(true);
    catalogAdmin.listSubjects().then(setRows).catch(fail).finally(() => setLoading(false));
  }, [fail]);
  useEffect(load, [load]);

  function open(row: CatalogSubject | "new") {
    setEditing(row);
    form.setFieldsValue(row === "new" ? { name_en: "", name_ar: "", is_active: true } : row);
  }

  async function save() {
    const values = await form.validateFields();
    try {
      if (editing === "new") await catalogAdmin.createSubject(values);
      else if (editing) await catalogAdmin.updateSubject(editing.id, values);
      message.success(dict.saved);
      setEditing(null);
      load();
    } catch (err) { fail(err); }
  }

  async function remove(id: number) {
    try { await catalogAdmin.deleteSubject(id); load(); } catch (err) { fail(err); }
  }

  const columns: ColumnsType<CatalogSubject> = [
    { title: dict.nameEn, dataIndex: "name_en" },
    { title: dict.nameAr, dataIndex: "name_ar" },
    { title: dict.active, dataIndex: "is_active", render: (a: boolean) => (a ? <Badge variant="success" size="sm">{dict.active}</Badge> : <Badge size="sm">{dict.inactive}</Badge>) },
    {
      title: "",
      key: "actions",
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => open(row)}>{dict.edit}</Button>
          <Popconfirm title={dict.confirmDelete} onConfirm={() => remove(row.id)}>
            <Button size="small" danger>{dict.remove}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <Button type="primary" className="self-start" onClick={() => open("new")}>{dict.newSubject}</Button>
      <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} size="middle" />
      <Modal open={editing != null} onCancel={() => setEditing(null)} onOk={save} title={editing === "new" ? dict.newSubject : dict.edit} okText={dict.save}>
        <Form form={form} layout="vertical" requiredMark={false} className="pt-2">
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Form.Item name="name_en" label={dict.nameEn} rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="name_ar" label={dict.nameAr} rules={[{ required: true }]}><Input dir="rtl" /></Form.Item>
          </div>
          <Form.Item name="is_active" label={dict.active} valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// --- Assignments (stage/track ↔ subject) -----------------------------------

function AssignmentsTab({ dict, locale }: { dict: Dict; locale: Locale }) {
  const fail = useFail(dict);
  const [stages, setStages] = useState<Stage[]>([]);
  const [subjects, setSubjects] = useState<CatalogSubject[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [stageId, setStageId] = useState<number | undefined>();
  const [trackId, setTrackId] = useState<number | null>(null);
  const [rows, setRows] = useState<StageSubject[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | undefined>();

  useEffect(() => {
    Promise.all([catalogAdmin.listStages(), catalogAdmin.listSubjects()])
      .then(([s, subj]) => { setStages(s); setSubjects(subj); setStageId((p) => p ?? s[0]?.id); })
      .catch(fail);
  }, [fail]);

  const stage = stages.find((s) => s.id === stageId);
  const needsTrack = stage != null && stage.child_kind !== "NONE";

  useEffect(() => {
    setTrackId(null);
    setTracks([]);
    if (stageId && needsTrack) catalogAdmin.listTracks(stageId).then(setTracks).catch(fail);
  }, [stageId, needsTrack, fail]);

  const load = useCallback(() => {
    if (!stageId || (needsTrack && !trackId)) { setRows([]); return; }
    setLoading(true);
    catalogAdmin.listAssignments(stageId, trackId).then(setRows).catch(fail).finally(() => setLoading(false));
  }, [stageId, trackId, needsTrack, fail]);
  useEffect(load, [load]);

  const assignedIds = new Set(rows.map((r) => r.subject));
  const addable = subjects.filter((s) => s.is_active && !assignedIds.has(s.id));

  async function add() {
    if (!stageId || !adding) return;
    try {
      await catalogAdmin.createAssignment({ vertical: stageId, track: needsTrack ? trackId : null, subject: adding });
      setAdding(undefined);
      load();
    } catch (err) { fail(err); }
  }

  async function remove(id: number) {
    try { await catalogAdmin.deleteAssignment(id); load(); } catch (err) { fail(err); }
  }

  const columns: ColumnsType<StageSubject> = [
    { title: dict.subject, key: "subject", render: (_, r) => (locale === "ar" ? r.subject_name_ar : r.subject_name_en) },
    {
      title: "",
      key: "actions",
      render: (_, row) => (
        <Popconfirm title={dict.confirmDelete} onConfirm={() => remove(row.id)}>
          <Button size="small" danger>{dict.remove}</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          style={{ minWidth: 200 }}
          value={stageId}
          onChange={setStageId}
          placeholder={dict.selectStage}
          options={stageSelectOptions(stages, locale)}
        />
        {needsTrack && (
          <Select
            style={{ minWidth: 200 }}
            value={trackId ?? undefined}
            onChange={(v) => setTrackId(v)}
            placeholder={dict.selectTrackFor.replace("{label}", trackWord(stage, dict, locale))}
            options={tracks.map((t) => ({ value: t.id, label: catalogName(t, locale) }))}
          />
        )}
      </div>

      {(!needsTrack || trackId) && (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            style={{ minWidth: 220 }}
            showSearch
            optionFilterProp="label"
            value={adding}
            onChange={setAdding}
            placeholder={dict.selectSubject}
            options={addable.map((s) => ({ value: s.id, label: catalogName(s, locale) }))}
          />
          <Button type="primary" disabled={!adding} onClick={add}>{dict.add}</Button>
        </div>
      )}

      <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} size="middle" />
    </div>
  );
}

  // A area selecionada define os textos e a lista local de cadastros.
    const requestedArea = new URLSearchParams(window.location.search).get("area") || "rede-de-clientes";
    const currentArea = requestedArea;
    const isDocumentationArea = currentArea === "documentacao";
    const isSettingsArea = currentArea === "configuracoes";
    const isPersonnelArea = currentArea === "departamento-pessoal";
    const isFinanceArea = currentArea === "financeiro-despesas" || currentArea === "financeiro-receitas";
    const isAlternateArea = isSettingsArea || isPersonnelArea || isFinanceArea;
    const storageKey = "god-sistemas-clientes-v1";
    const employeesStorageKey = "god-sistemas-colaboradores-v1";
    const preferencesStorageKey = "god-sistemas-preferencias-v1";
    const documentationDatabaseName = "god-sistemas-documentos-v1";
    const documentationStoreName = "files";
    const dialog = document.querySelector("#client-dialog");
    const form = document.querySelector("#client-form");
    const rows = document.querySelector("#client-rows");
    const search = document.querySelector("#search");
    const emptyState = document.querySelector("#empty-state");
    const statusDropdown = document.querySelector("#status-dropdown");
    const statusMenuToggle = document.querySelector("#status-menu-toggle");
    const statusMenu = document.querySelector("#status-menu");
    const tableHead = document.querySelector("#client-table-head");
    const workStatuses = ["Não iniciada", "Em andamento", "Concluída"];
    const documentTypes = [
      { label: "Proposta", type: "proposal" },
      { label: "Contrato", type: "contract" },
      { label: "Ficha Cadastral", type: "registration" }
    ];
    const documentationStatuses = ["🔴 Pendente", "🟢 Completa"];
    for (let missingMask = 1; missingMask < 7; missingMask += 1) {
      const missingDocuments = documentTypes.filter((_, index) => missingMask & (1 << index)).map((document) => document.label);
      documentationStatuses.push(`🟡 Pendente em ${missingDocuments.join(" e ")}`);
    }
    let clients = loadClients();
    let documentationFiles = new Map();
    let pendingCommercialFiles = new Map();
    let editingId = null;
    let editingEmployeeId = null;
    let activeEmployeeView = "gallery";
    let employeePhotoPreviewUrl = null;
    const employeePhotoUrls = new Map();
    let activeStatus = isDocumentationArea ? "Todas as etapas" : "Todas";
    let toastTimer;
    let documentationFilesReady = Promise.resolve();

    function getAreaStatuses() {
      return isDocumentationArea ? documentationStatuses : workStatuses;
    }

    function getStatusLabel() {
      return isDocumentationArea ? "Todas as etapas" : "Todas";
    }

    function renderStatusMenu() {
      const allLabel = getStatusLabel();
      const statuses = isDocumentationArea ? [allLabel, ...getAreaStatuses()] : getAreaStatuses();
      statusMenu.setAttribute("aria-label", isDocumentationArea ? "Etapas do processo" : "Situações da obra");
      statusMenuToggle.setAttribute("aria-label", isDocumentationArea ? "Filtrar documentação por etapa" : "Filtrar obras por situação");
      statusMenu.innerHTML = statuses.map((status) => `
        <button class="status-menu-item" type="button" role="menuitemradio" data-status="${escapeHtml(status)}" aria-checked="${String(activeStatus === status)}">
          <span>${escapeHtml(status)}</span><span class="status-count">0</span>
        </button>`).join("");
    }

    function getWorkStatus(client) {
      if (workStatuses.includes(client.workStatus)) return client.workStatus;
      if (workStatuses.includes(client.status)) return client.status;
      if (client.status === "Finalizada" || client.status === "Completa") return "Concluída";
      return "Não iniciada";
    }

    function getDocumentationStatus(client) {
      const missingDocuments = documentTypes
        .filter((document) => !documentationFiles.has(`${client.id}:${document.type}`)
          && (!(client.id === editingId || !client.id) || !pendingCommercialFiles.has(document.type)))
        .map((document) => document.label);
      if (missingDocuments.length === 0) return "🟢 Completa";
      if (missingDocuments.length === documentTypes.length) return "🔴 Pendente";
      return `🟡 Pendente em ${missingDocuments.join(" e ")}`;
    }

    function updateCommercialDocumentFields(clientId) {
      documentTypes.forEach((docInfo) => {
        const container = document.querySelector(`#commercial-${docInfo.type}`);
        const key = clientId ? `${clientId}:${docInfo.type}` : "";
        const file = key ? documentationFiles.get(key) : null;
        const name = container.querySelector(".linked-document-name");
        const pendingFile = pendingCommercialFiles.get(docInfo.type);
        name.replaceChildren();
        if (pendingFile) {
          name.textContent = pendingFile.name;
        } else if (file) {
          const link = document.createElement("button");
          link.className = "document-file-name";
          link.type = "button";
          link.dataset.fileAction = "download";
          link.dataset.fileKey = key;
          link.title = `Baixar ${file.name}`;
          link.textContent = file.name;
          name.append(link);
        } else {
          name.textContent = "Sem documento anexado.";
        }
      });
      const client = clients.find((item) => item.id === clientId);
      document.querySelector("#commercial-documentation-status").textContent = getDocumentationStatus(client || { id: "" });
    }

    const areaLabels = {
      "rede-de-clientes": "Área comercial",
      documentacao: "Área comercial",
      configuracoes: "Preferências",
      "departamento-pessoal": "Departamento Pessoal",
      "financeiro-despesas": "Financeiro · Despesas",
      "financeiro-receitas": "Financeiro · Receitas"
    };
    document.querySelector("#top-label").lastChild.textContent = areaLabels[currentArea] || areaLabels["rede-de-clientes"];
    document.querySelector("#client-content").hidden = isAlternateArea;
    document.querySelector("#settings-page").hidden = !isSettingsArea;
    document.querySelector("#personnel-page").hidden = !isPersonnelArea;
    document.querySelector("#finance-page").hidden = !isFinanceArea;
    document.querySelector("#client-dialog").hidden = isAlternateArea;
    document.querySelector("#employee-dialog").hidden = !isPersonnelArea;
    document.querySelector("#settings-page").classList.toggle("alternate-page-active", isSettingsArea);
    document.querySelector("#personnel-page").classList.toggle("alternate-page-active", isPersonnelArea);
    document.querySelector("#finance-page").classList.toggle("alternate-page-active", isFinanceArea);
    document.querySelector("#page-title").textContent = isDocumentationArea ? "Documentação" : "Rede de Clientes";
    document.querySelector("#add-client-label").textContent = isDocumentationArea ? "Novo registro" : "Novo cliente";
    document.querySelector("#empty-add").textContent = isDocumentationArea ? "Cadastrar primeiro registro" : "Cadastrar primeiro cliente";
    renderStatusMenu();
    if (isDocumentationArea) {
      document.querySelector("#add-client").hidden = true;
      document.querySelector("#client-section").setAttribute("aria-label", "Documentação dos clientes");
      document.querySelector("#search").placeholder = "Buscar construtora ou obra";
      document.querySelector("#search").setAttribute("aria-label", "Buscar construtora ou obra");
      document.querySelector("#table-footer").textContent = "Construtora, obra e tempo vêm da Rede de Clientes. Os anexos ficam salvos neste navegador.";
      document.querySelector("#empty-add").hidden = true;
      document.querySelector("table").classList.add("documentation-table");
      tableHead.innerHTML = "<tr><th>Construtora / obra</th><th>Etapa do processo</th><th>Proposta</th><th>Contrato</th><th>Ficha Cadastral</th><th>Tempo de Obra</th></tr>";
    }
    document.querySelector("#commercial-dropdown").open = isDocumentationArea || currentArea === "rede-de-clientes";
    document.querySelector("#administrative-dropdown").open = isPersonnelArea || isFinanceArea;
    document.querySelectorAll(".nav-subitem, .settings-link").forEach((link) => {
      if (link.dataset.area === currentArea) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }
    });
    document.querySelector(".nav-nested-dropdown").open = isFinanceArea;
    document.title = `${isSettingsArea ? "Preferências" : isPersonnelArea ? "Departamento Pessoal" : isFinanceArea ? "Financeiro" : isDocumentationArea ? "Documentação" : "Rede de Clientes"} | GOD Sistemas de Proteções`;
    if (isFinanceArea) {
      const financeTitle = currentArea === "financeiro-despesas" ? "Despesas" : "Receitas";
      document.querySelector("#finance-title").textContent = financeTitle;
      document.querySelector("#finance-description").textContent = `Acompanhe os lançamentos de ${financeTitle.toLocaleLowerCase("pt-BR")}.`;
      document.querySelector("#finance-empty-title").textContent = `Nenhuma ${financeTitle.toLocaleLowerCase("pt-BR").replace(/s$/, "")} cadastrada`;
    }

    function loadPreferences() {
      try {
        const stored = JSON.parse(localStorage.getItem(preferencesStorageKey) || "{}");
        return {
          theme: ["system", "light", "dark"].includes(stored.theme) ? stored.theme : "light",
          language: ["pt-BR", "en-US", "es"].includes(stored.language) ? stored.language : "pt-BR",
          timezone: ["local", "America/Sao_Paulo", "UTC"].includes(stored.timezone) ? stored.timezone : "local"
        };
      } catch {
        return { theme: "light", language: "pt-BR", timezone: "local" };
      }
    }

    let preferences = loadPreferences();

    function applyTheme(theme) {
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme === "system" ? "light dark" : theme;
    }

    function savePreferences() {
      localStorage.setItem(preferencesStorageKey, JSON.stringify(preferences));
      applyTheme(preferences.theme);
      document.documentElement.lang = preferences.language;
      document.querySelector("#settings-feedback").textContent = "Preferências salvas neste dispositivo.";
    }

    applyTheme(preferences.theme);
    document.documentElement.lang = preferences.language;
    if (isSettingsArea) {
      document.querySelector("#theme-preference").value = preferences.theme;
      document.querySelector("#language-preference").value = preferences.language;
      document.querySelector("#timezone-preference").value = preferences.timezone;
    }

    function loadEmployees() {
      try {
        const stored = JSON.parse(localStorage.getItem(employeesStorageKey) || "[]");
        return Array.isArray(stored) ? stored.filter((employee) => employee && typeof employee.id === "string" && typeof employee.name === "string") : [];
      } catch {
        return [];
      }
    }

    let employees = loadEmployees();

    function saveEmployees() {
      localStorage.setItem(employeesStorageKey, JSON.stringify(employees));
    }

    function parseEmployeeDate(value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
    }

    function addEmployeeMonths(date, months) {
      const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(date.getDate(), lastDay));
      return target;
    }

    function formatEmployeeRegistrationTime(value) {
      if (!value) return "Sem data de admissão";
      const admissionDate = parseEmployeeDate(value);
      if (!admissionDate) return "Data de admissão inválida";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (admissionDate > today) return "Data de admissão futura";

      let years = today.getFullYear() - admissionDate.getFullYear();
      let anniversary = addEmployeeMonths(admissionDate, years * 12);
      if (anniversary > today) {
        years -= 1;
        anniversary = addEmployeeMonths(admissionDate, years * 12);
      }

      let months = (today.getFullYear() - anniversary.getFullYear()) * 12 + today.getMonth() - anniversary.getMonth();
      let elapsedMonths = addEmployeeMonths(admissionDate, years * 12 + months);
      if (elapsedMonths > today) {
        months -= 1;
        elapsedMonths = addEmployeeMonths(admissionDate, years * 12 + months);
      }
      const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      const utcElapsedMonths = Date.UTC(elapsedMonths.getFullYear(), elapsedMonths.getMonth(), elapsedMonths.getDate());
      const days = Math.floor((utcToday - utcElapsedMonths) / 86400000);
      return `${years} ${years === 1 ? "ano" : "anos"}, ${months} ${months === 1 ? "mês" : "meses"}, ${days} ${days === 1 ? "dia" : "dias"}`;
    }

    function getEmployeeBirthday(value) {
      const birthDate = parseEmployeeDate(value);
      if (!birthDate) return "";
      const year = new Date().getFullYear();
      const month = birthDate.getMonth();
      const day = Math.min(birthDate.getDate(), new Date(year, month + 1, 0).getDate());
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    function updateEmployeeComputedFields() {
      const employeeForm = document.querySelector("#employee-form");
      document.querySelector("#employee-registration-time").value = formatEmployeeRegistrationTime(employeeForm.elements.admissionDate.value);
      document.querySelector("#employee-birthday").value = getEmployeeBirthday(employeeForm.elements.birthDate.value);
    }

    function getEmployeePhotoKey(employeeId) {
      return `employee:${employeeId}:photo`;
    }

    function getEmployeePhotoUrl(employeeId) {
      const key = getEmployeePhotoKey(employeeId);
      const photo = documentationFiles.get(key);
      if (!photo?.blob) return "";
      if (!employeePhotoUrls.has(key)) employeePhotoUrls.set(key, URL.createObjectURL(photo.blob));
      return employeePhotoUrls.get(key);
    }

    function updateEmployeePhotoPreview(file = null) {
      if (employeePhotoPreviewUrl) URL.revokeObjectURL(employeePhotoPreviewUrl);
      employeePhotoPreviewUrl = file ? URL.createObjectURL(file) : null;
      const preview = document.querySelector("#employee-photo-preview");
      const empty = document.querySelector("#employee-photo-empty");
      const savedPhoto = editingEmployeeId && documentationFiles.get(getEmployeePhotoKey(editingEmployeeId));
      const photoUrl = employeePhotoPreviewUrl || (savedPhoto && getEmployeePhotoUrl(editingEmployeeId));
      preview.hidden = !photoUrl;
      preview.removeAttribute("src");
      if (photoUrl) preview.src = photoUrl;
      empty.hidden = Boolean(photoUrl);
      document.querySelector("#employee-photo-filename").textContent = file?.name || savedPhoto?.name || "JPG, PNG ou outro formato de imagem (até 10 MB)";
    }

    async function saveEmployeePhoto(employeeId, file) {
      const database = await openDocumentationDatabase();
      const record = { key: getEmployeePhotoKey(employeeId), employeeId, type: "employee-photo", name: file.name, blob: file, updatedAt: Date.now() };
      try {
        await new Promise((resolve, reject) => {
          const transaction = database.transaction(documentationStoreName, "readwrite");
          transaction.objectStore(documentationStoreName).put(record);
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        });
      } finally {
        database.close();
      }
      const oldUrl = employeePhotoUrls.get(record.key);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      employeePhotoUrls.delete(record.key);
      documentationFiles.set(record.key, record);
    }

    function renderEmployeeCards(group) {
      return group.map((employee) => {
        const photoUrl = getEmployeePhotoUrl(employee.id);
        const avatar = photoUrl
          ? `<img src="${escapeHtml(photoUrl)}" alt="Foto de ${escapeHtml(employee.name)}">`
          : escapeHtml(employee.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-BR"));
        return `
          <article class="employee-card">
            <div class="employee-avatar ${photoUrl ? "has-photo" : ""}">${avatar}</div>
            <div class="employee-card-body"><h3>${escapeHtml(employee.name)}</h3><span class="employee-tag">${escapeHtml(employee.department)}</span><span class="employee-tag employee-tag-function">${escapeHtml(employee.jobFunction)}</span><span class="employee-active ${employee.active ? "is-active" : "is-inactive"}"><span></span>${employee.active ? "Ativo" : "Inativo"}</span>
              <div class="employee-card-actions"><span>${escapeHtml(employee.contract || "Contrato não informado")}</span><button type="button" class="employee-edit" data-employee-id="${escapeHtml(employee.id)}">Editar</button></div>
            </div>
          </article>`;
      }).join("");
    }

    function renderEmployees() {
      const grid = document.querySelector("#employee-grid");
      const empty = document.querySelector("#employee-empty");
      if (activeEmployeeView === "departments" || activeEmployeeView === "functions") {
        const property = activeEmployeeView === "departments" ? "department" : "jobFunction";
        const groupedEmployees = employees.reduce((groups, employee) => {
              const groupName = employee[property] || "Sem classificação";
              groups.set(groupName, [...(groups.get(groupName) || []), employee]);
              return groups;
            }, new Map());
        grid.innerHTML = [...groupedEmployees.entries()].map(([name, group]) => `
          <article class="employee-group-card"><span class="employee-group-count">${group.length}</span><h3>${escapeHtml(name)}</h3><p>${group.length} ${group.length === 1 ? "colaborador" : "colaboradores"}</p></article>`).join("");
        empty.hidden = groupedEmployees.size > 0;
      } else if (activeEmployeeView === "contracts") {
        const contracts = [
          { name: "CLT", matches: ["clt"] },
          { name: "Contrato Social", matches: ["contrato social"] },
          { name: "Freelancer/Autônomo", matches: ["freelancer/autônomo", "freelancer/autonomo"] }
        ];
        grid.innerHTML = contracts.map((contract) => {
          const group = employees.filter((employee) => contract.matches.includes(String(employee.contract || "").trim().toLocaleLowerCase("pt-BR")));
          return `<section class="employee-contract-group"><div class="employee-contract-heading"><h2>${escapeHtml(contract.name)}</h2><span class="employee-group-count">${group.length}</span></div><div class="employee-contract-grid">${renderEmployeeCards(group)}</div></section>`;
        }).join("");
        empty.hidden = employees.length > 0;
      } else {
        grid.innerHTML = renderEmployeeCards(employees);
        empty.hidden = employees.length > 0;
      }
    }

    if (isPersonnelArea) renderEmployees();

    function loadClients() {
      // Recupera os cadastros deste navegador; dados invalidos iniciam uma lista vazia.
      try {
        const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
        return Array.isArray(value) ? value.filter((item) => item && typeof item.id === "string") : [];
      } catch {
        return [];
      }
    }

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    }

    function normalizeCnpj(value) {
      return String(value ?? "").replace(/\D/g, "");
    }

    function parseDate(value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
    }

    function getTodayDate() {
      const today = new Date();
      return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    }

    function formatClientDate(value) {
      const date = parseDate(value);
      if (!date) return "—";
      date.setUTCHours(12);
      const timeZone = preferences.timezone === "local" ? undefined : preferences.timezone;
      return new Intl.DateTimeFormat(preferences.language, { timeZone }).format(date);
    }

    function getWholeMonthsBetween(start, end) {
      const monthDifference = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
      if (monthDifference > 0 && end.getUTCDate() < start.getUTCDate()) return monthDifference - 1;
      if (monthDifference < 0 && end.getUTCDate() > start.getUTCDate()) return monthDifference + 1;
      return monthDifference;
    }

    function getWorkDuration(client) {
      const start = parseDate(client.startDate);
      if (!start) return "Não iniciada";
      const actualEnd = parseDate(client.actualEndDate);
      const today = getTodayDate();
      if (!actualEnd && today < start) return "Não iniciada";
      const end = actualEnd || today;
      if (end < start) return "Término anterior ao início";

      const daysBetween = Math.floor((end - start) / 86400000);
      const monthsBetween = getWholeMonthsBetween(start, end);
      const years = Math.floor(monthsBetween / 12);
      const months = monthsBetween % 12;
      const days = daysBetween - monthsBetween * 30;
      return [
        years > 0 ? `${years} ${years === 1 ? "ano" : "anos"}` : "",
        months > 0 ? `${months} ${months === 1 ? "mês" : "meses"}` : "",
        days > 0 ? `${days} ${days === 1 ? "dia" : "dias"}` : "0 dias"
      ].filter(Boolean).join(" ");
    }

    function getPlannedDuration(client) {
      const start = parseDate(client.startDate);
      const end = parseDate(client.plannedEndDate);
      if (!start || !end) return "—";
      const months = getWholeMonthsBetween(start, end);
      return months < 0 ? "Término anterior ao início" : String(months);
    }

    function isClientActive(client) {
      const start = parseDate(client.startDate);
      if (!start) return false;
      const today = getTodayDate();
      const end = parseDate(client.actualEndDate) || parseDate(client.plannedEndDate);
      return today >= start && (!end || (end >= start && today <= end));
    }

    function updateOperationalCalculations() {
      const client = {
        startDate: form.elements.startDate.value,
        actualEndDate: form.elements.actualEndDate.value,
        plannedEndDate: form.elements.plannedEndDate.value
      };
      document.querySelector("#duration").value = getWorkDuration(client);
      document.querySelector("#plannedDurationMonths").value = getPlannedDuration(client);
      const active = isClientActive(client);
      document.querySelector("#activeClient").checked = active;
      document.querySelector("#activeClientLabel").textContent = active ? "Ativo" : "";
    }

    function updateWorkingDaysLabel() {
      const selectedDays = [...form.querySelectorAll('input[name="workingDays"]:checked')].map((input) => input.value);
      document.querySelector("#working-days-label").textContent = selectedDays.length
        ? selectedDays.map((day) => day.charAt(0).toLocaleUpperCase("pt-BR") + day.slice(1)).join(", ")
        : "Selecione os dias";
    }

    function saveClients() {
      // Grava a lista atual no armazenamento local do navegador.
      localStorage.setItem(storageKey, JSON.stringify(clients));
    }

    function openDocumentationDatabase() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(documentationDatabaseName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(documentationStoreName, { keyPath: "key" });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    async function loadDocumentationFiles() {
      const database = await openDocumentationDatabase();
      return new Promise((resolve, reject) => {
        const request = database.transaction(documentationStoreName, "readonly").objectStore(documentationStoreName).getAll();
        request.onsuccess = () => {
          documentationFiles = new Map(request.result.map((file) => [file.key, file]));
          database.close();
          resolve();
        };
        request.onerror = () => {
          database.close();
          reject(request.error);
        };
      });
    }

    async function saveDocumentationFile(client, type, file) {
      const database = await openDocumentationDatabase();
      const record = { key: `${client.id}:${type}`, clientId: client.id, type, name: file.name, blob: file, updatedAt: Date.now() };
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(documentationStoreName, "readwrite");
        transaction.objectStore(documentationStoreName).put(record);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
      documentationFiles.set(record.key, record);
    }

    async function removeDocumentationFile(key) {
      const database = await openDocumentationDatabase();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(documentationStoreName, "readwrite");
        transaction.objectStore(documentationStoreName).delete(key);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
      documentationFiles.delete(key);
    }

    function downloadDocumentationFile(key) {
      const file = documentationFiles.get(key);
      if (!file) return;
      const downloadUrl = URL.createObjectURL(file.blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = file.name;
      downloadLink.click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    }

    function getStatusClass(status) {
      if (status.startsWith("🟢")) return "status-completed";
      if (status.startsWith("🔴")) return "status-pending";
      if (status.startsWith("🟡")) return "status-pending-registration";
      return {
        "Não iniciada": "status-pending",
        "Em andamento": "status-pending-contract",
        "Concluída": "status-completed",
        "Pendente": "status-pending",
        "Pendente em Contrato": "status-pending-contract",
        "Pendente em contrato e Ficha Cadastral": "status-pending-registration",
        "Pendente em Proposta e Contrato": "status-pending-proposal",
        "Completa": "status-completed"
      }[status];
    }

    function renderDocumentationCell(client, type, label) {
      const key = `${client.id}:${type}`;
      const file = documentationFiles.get(key);
      return `<td class="document-cell">
        <div class="document-cell-content">
          ${file ? `<button class="document-file-name" type="button" data-file-action="download" data-file-key="${escapeHtml(key)}" title="Baixar ${escapeHtml(file.name)}">${escapeHtml(file.name)}</button>` : '<span class="document-empty">Sem arquivo</span>'}
          <div class="document-actions">
            <label class="document-upload" title="Anexar ${label}" aria-label="Anexar ${label} para ${escapeHtml(client.company)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M5 14v5h14v-5"/></svg>
              <input class="document-file-input" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.jpg,.jpeg,.png" data-client-id="${escapeHtml(client.id)}" data-document-type="${type}" aria-label="Anexar ${label} para ${escapeHtml(client.company)}">
            </label>
            ${file ? `<button class="icon-button document-remove" type="button" data-file-action="remove" data-file-key="${escapeHtml(key)}" aria-label="Remover ${label} de ${escapeHtml(client.company)}" title="Remover anexo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16m-10 4v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>` : ""}
          </div>
        </div>
      </td>`;
    }

    function renderDocumentationClient(client) {
      return `<tr>
        <td><span class="primary-cell">${escapeHtml(client.company)}</span><span class="secondary-cell">${escapeHtml(client.project)}</span></td>
        <td><span class="status-badge ${getStatusClass(getDocumentationStatus(client))}">${escapeHtml(getDocumentationStatus(client))}</span></td>
        ${renderDocumentationCell(client, "proposal", "Proposta")}
        ${renderDocumentationCell(client, "contract", "Contrato")}
        ${renderDocumentationCell(client, "registration", "Ficha Cadastral")}
        <td>${escapeHtml(getWorkDuration(client))}</td>
      </tr>`;
    }

    function render() {
      // Atualiza contadores, filtros e linhas conforme a busca e o status selecionado.
      const query = search.value.trim().toLocaleLowerCase("pt-BR");
      const queryDigits = query.replace(/\D/g, "");
      const searched = clients.filter((client) => {
        const searchableFields = isDocumentationArea
          ? [client.company, client.project, client.duration, getDocumentationStatus(client)]
          : Object.values(client);
        const matchesText = searchableFields.some((value) => String(value).toLocaleLowerCase("pt-BR").includes(query));
        const matchesCnpj = !isDocumentationArea && queryDigits.length > 0 && normalizeCnpj(client.cnpj).includes(queryDigits);
        return matchesText || matchesCnpj;
      });
      const allStatusesLabel = getStatusLabel();
      const getStatusForArea = isDocumentationArea ? getDocumentationStatus : getWorkStatus;
      const filtered = searched.filter((client) => activeStatus === allStatusesLabel || getStatusForArea(client) === activeStatus);
      document.querySelector("#status-current-label").textContent = activeStatus;
      const selectedCount = activeStatus === allStatusesLabel ? searched.length : searched.filter((client) => getStatusForArea(client) === activeStatus).length;
      document.querySelector("#selected-status-count").textContent = selectedCount;
      document.querySelectorAll(".status-menu-item").forEach((button) => {
        const status = button.dataset.status;
        const count = status === allStatusesLabel ? searched.length : searched.filter((client) => getStatusForArea(client) === status).length;
        button.querySelector(".status-count").textContent = count;
        button.setAttribute("aria-checked", String(activeStatus === status));
      });
      rows.innerHTML = filtered.map((client) => {
        if (isDocumentationArea) return renderDocumentationClient(client);
        const status = getWorkStatus(client);
        return `
        <tr>
          <td><span class="primary-cell">${escapeHtml(client.company)}</span><span class="secondary-cell">${escapeHtml(client.project)}</span></td>
          <td><span class="primary-cell">${escapeHtml(client.legalName)}</span><span class="secondary-cell">${escapeHtml(client.cnpj)}</span></td>
          <td>${escapeHtml(client.address)}</td>
          <td>${escapeHtml(getWorkDuration(client))}</td>
          <td>${escapeHtml(formatClientDate(client.startDate))}</td>
          <td>${escapeHtml(formatClientDate(client.actualEndDate || client.plannedEndDate))}</td>
          <td><span class="status-badge ${getStatusClass(status)}">${escapeHtml(status)}</span></td>
          <td class="action-cell"><button class="icon-button edit-client" type="button" data-id="${escapeHtml(client.id)}" aria-label="Editar ${escapeHtml(client.company)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z"/></svg></button></td>
        </tr>`;
      }).join("");
      emptyState.hidden = filtered.length > 0;
      document.querySelector("#table-footer").hidden = clients.length === 0;
      if (clients.length > 0 && filtered.length === 0) {
        document.querySelector("#empty-title").textContent = query ? "Nenhum resultado encontrado" : `Nenhum ${isDocumentationArea ? "registro" : "cliente"} em ${activeStatus}`;
        document.querySelector("#empty-description").textContent = query ? "Tente buscar por outro nome, obra ou CNPJ." : "Escolha outro status ou cadastre um cliente nesta categoria.";
        document.querySelector("#empty-add").hidden = true;
      } else {
        document.querySelector("#empty-title").textContent = isDocumentationArea ? "Nenhum cliente na Rede de Clientes" : "Nenhum cliente cadastrado";
        document.querySelector("#empty-description").textContent = isDocumentationArea ? "Cadastre o cliente na Rede de Clientes para anexar documentos." : "Cadastre uma construtora e sua primeira obra para começar.";
        document.querySelector("#empty-add").hidden = isDocumentationArea;
      }
    }

    function showToast(message) {
      const toast = document.querySelector("#toast");
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
    }

    function closeDialog() {
      if (!dialog.open) return;
      dialog.close();
    }

    async function openForm(client = null) {
      // Preenche o formulario para edicao ou prepara um novo cadastro.
      if (dialog.open) return;
      await documentationFilesReady;
      editingId = client?.id ?? null;
      pendingCommercialFiles.clear();
      form.reset();
      form.querySelectorAll(".form-section").forEach((section, index) => {
        section.open = index === 0;
      });
      document.querySelector(".multi-select").open = false;
      updateWorkingDaysLabel();
      document.querySelector("#dialog-title").textContent = client ? `Editar ${isDocumentationArea ? "registro" : "cliente"}` : isDocumentationArea ? "Novo registro" : "Novo cliente";
      document.querySelector("#save-client").textContent = client ? "Salvar alterações" : isDocumentationArea ? "Salvar registro" : "Salvar cliente";
      document.querySelector("#delete-client").hidden = !client;
      document.querySelector("#delete-client").textContent = isDocumentationArea ? "Excluir registro" : "Excluir cliente";
      if (client) {
        for (const field of ["company", "project", "address", "legalName", "cnpj", "invoiceDueDate", "workStartTime", "workEndTime", "plannedStartDate", "startDate", "plannedEndDate", "actualEndDate", "quantityOnSite", "recessKit", "workSystem", "approvalDeadline", "tstPhone", "tstEmail", "proposalDate", "proposalStatus"]) form.elements[field].value = client[field] || "";
        form.elements.workStatus.value = getWorkStatus(client);
        form.elements.installation.checked = Boolean(client.installation);
        form.elements.inspection.checked = Boolean(client.inspection);
        const workingDays = Array.isArray(client.workingDays) ? client.workingDays : [];
        form.querySelectorAll('input[name="workingDays"]').forEach((input) => {
          input.checked = workingDays.includes(input.value);
        });
        updateWorkingDaysLabel();
      }
      updateOperationalCalculations();
      updateCommercialDocumentFields(client?.id);
      dialog.showModal();
      form.elements.company.focus();
    }

    document.querySelector("#add-client").addEventListener("click", () => openForm());
    
      // Conecta os botoes, a busca, os filtros e o campo formatado de CNPJ.
    document.querySelector("#empty-add").addEventListener("click", () => openForm());
    document.querySelector("#cancel-dialog").addEventListener("click", () => closeDialog());
    document.querySelector("#close-dialog").addEventListener("click", () => closeDialog());
    form.addEventListener("invalid", (event) => {
      event.target.closest(".form-section")?.setAttribute("open", "");
    }, true);
    form.addEventListener("input", updateOperationalCalculations);
    form.addEventListener("change", updateOperationalCalculations);
    form.addEventListener("click", (event) => {
      const button = event.target.closest('[data-file-action="download"]');
      if (button) downloadDocumentationFile(button.dataset.fileKey);
    });
    form.addEventListener("change", (event) => {
      const input = event.target.closest(".commercial-file-input");
      const file = input?.files?.[0];
      if (!input || !file) return;
      pendingCommercialFiles.set(input.dataset.documentType, file);
      updateCommercialDocumentFields(editingId);
    });
    form.querySelectorAll('input[name="workingDays"]').forEach((input) => {
      input.addEventListener("change", updateWorkingDaysLabel);
    });
    form.querySelectorAll(".form-section").forEach((section) => {
      section.addEventListener("toggle", () => {
        if (!section.open) return;
        form.querySelectorAll(".form-section").forEach((otherSection) => {
          if (otherSection !== section) otherSection.open = false;
        });
      });
    });
    dialog.addEventListener("close", () => {
      form.querySelectorAll(".form-section").forEach((section) => {
        section.open = false;
      });
      document.querySelector("#commercial-dropdown").open = false;
    });
    search.addEventListener("input", render);
    statusMenuToggle.addEventListener("click", () => {
      const isOpen = statusMenuToggle.getAttribute("aria-expanded") === "true";
      statusMenu.hidden = isOpen;
      statusMenuToggle.setAttribute("aria-expanded", String(!isOpen));
      if (!isOpen) (statusMenu.querySelector(`[data-status="${activeStatus}"]`) || statusMenu.querySelector(".status-menu-item"))?.focus();
    });
    statusMenu.addEventListener("click", (event) => {
      const button = event.target.closest(".status-menu-item");
      if (!button) return;
      activeStatus = button.dataset.status === activeStatus ? getStatusLabel() : button.dataset.status;
      statusMenu.hidden = true;
      statusMenuToggle.setAttribute("aria-expanded", "false");
      statusMenuToggle.focus();
      render();
    });
    document.addEventListener("click", (event) => {
      if (statusDropdown.contains(event.target)) return;
      statusMenu.hidden = true;
      statusMenuToggle.setAttribute("aria-expanded", "false");
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || statusMenu.hidden) return;
      statusMenu.hidden = true;
      statusMenuToggle.setAttribute("aria-expanded", "false");
      statusMenuToggle.focus();
    });
    rows.addEventListener("click", (event) => {
      const button = event.target.closest(".edit-client");
      if (!button) return;
      const client = clients.find((item) => item.id === button.dataset.id);
      if (client) openForm(client);
    });
    rows.addEventListener("change", async (event) => {
      const input = event.target.closest(".document-file-input");
      const file = input?.files?.[0];
      const client = clients.find((item) => item.id === input?.dataset.clientId);
      if (!isDocumentationArea || !file || !client) return;
      try {
        await saveDocumentationFile(client, input.dataset.documentType, file);
        render();
        showToast("Arquivo anexado.");
      } catch (error) {
        console.error("Não foi possível salvar o arquivo.", error);
        showToast("Não foi possível salvar o arquivo neste navegador.");
      }
    });
    rows.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-file-action]");
      if (!button) return;
      const file = documentationFiles.get(button.dataset.fileKey);
      if (!file) return;
      if (button.dataset.fileAction === "remove") {
        if (!isDocumentationArea) return;
        if (!confirm(`Remover o arquivo ${file.name}?`)) return;
        try {
          await removeDocumentationFile(file.key);
          render();
          showToast("Arquivo removido.");
        } catch (error) {
          console.error("Não foi possível remover o arquivo.", error);
          showToast("Não foi possível remover o arquivo.");
        }
        return;
      }
      downloadDocumentationFile(button.dataset.fileKey);
    });
    document.querySelector("#cnpj").addEventListener("input", (event) => {
      const digits = event.target.value.replace(/\D/g, "").slice(0, 14);
      event.target.value = digits
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    });

    form.addEventListener("submit", async (event) => {

      // Valida e salva o cadastro, impedindo CNPJs duplicados.
      event.preventDefault();
      if (!form.reportValidity()) return;
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      data.workingDays = formData.getAll("workingDays");
      data.installation = form.elements.installation.checked;
      data.inspection = form.elements.inspection.checked;
      const cnpjDigits = normalizeCnpj(data.cnpj);
      const duplicate = cnpjDigits.length > 0 && clients.some((client) => {
        const clientCnpj = normalizeCnpj(client.cnpj);
        return clientCnpj && clientCnpj === cnpjDigits && client.id !== editingId;
      });
      if (duplicate) {
        form.elements.cnpj.setCustomValidity("Este CNPJ já está cadastrado.");
        form.elements.cnpj.reportValidity();
        form.elements.cnpj.addEventListener("input", () => form.elements.cnpj.setCustomValidity(""), { once: true });
        return;
      }
      const wasEditing = Boolean(editingId);
      const clientId = editingId || crypto.randomUUID();
      const clientData = { id: clientId, ...data };
      const previousClients = clients;
      if (wasEditing) {
        clients = clients.map((client) => client.id === editingId ? clientData : client);
      } else {
        clients.unshift(clientData);
      }
      const saveButton = document.querySelector("#save-client");
      saveButton.disabled = true;
      try {
        saveClients();
      } catch (error) {
        clients = previousClients;
        console.error("Não foi possível salvar o cadastro.", error);
        showToast("Não foi possível salvar o cadastro neste navegador.");
        saveButton.disabled = false;
        return;
      }

      editingId = clientId;
      const failedUploads = [];
      for (const [type, file] of pendingCommercialFiles) {
        try {
          await saveDocumentationFile(clientData, type, file);
          pendingCommercialFiles.delete(type);
        } catch (error) {
          console.error(`Não foi possível salvar o documento ${file.name}.`, error);
          failedUploads.push(file.name);
        }
      }
      render();
      updateCommercialDocumentFields(clientId);
      saveButton.disabled = false;
      if (failedUploads.length) {
        document.querySelector("#dialog-title").textContent = `Editar cliente`;
        saveButton.textContent = "Salvar alterações";
        document.querySelector("#delete-client").hidden = false;
        document.querySelector("#delete-client").textContent = "Excluir cliente";
        showToast("Cadastro salvo, mas não foi possível anexar: " + failedUploads.join(", "));
        return;
      }
      pendingCommercialFiles.clear();
      closeDialog();
      showToast(wasEditing ? "Cadastro atualizado." : isDocumentationArea ? "Registro cadastrado." : "Cliente cadastrado.");
    });

    if (isSettingsArea) {
      document.querySelector("#theme-preference").addEventListener("change", (event) => {
        preferences.theme = event.target.value;
        savePreferences();
      });
      document.querySelector("#language-preference").addEventListener("change", (event) => {
        preferences.language = event.target.value;
        savePreferences();
      });
      document.querySelector("#timezone-preference").addEventListener("change", (event) => {
        preferences.timezone = event.target.value;
        savePreferences();
      });
    }

    if (isPersonnelArea) {
      const employeeDialog = document.querySelector("#employee-dialog");
      const employeeForm = document.querySelector("#employee-form");
      const employeePhotoInput = document.querySelector("#employee-photo");
      const openEmployeeForm = async (employee = null) => {
        await documentationFilesReady;
        editingEmployeeId = employee?.id ?? null;
        employeeForm.querySelectorAll(".legacy-option").forEach((option) => option.remove());
        employeeForm.reset();
        document.querySelector("#employee-form-feedback").textContent = "";
        employeePhotoInput.setCustomValidity("");
        document.querySelector("#employee-dialog-title").textContent = employee ? "Editar colaborador" : "Novo colaborador";
        if (employee) {
          ["name", "cpf", "birthDate", "address", "email", "pix", "department", "registrationNumber", "admissionDate", "pantsSize", "shirtSize", "shoeSize", "baseSalary", "pis"].forEach((field) => {
            employeeForm.elements.namedItem(field).value = employee[field] || "";
          });
          ["jobFunction", "contract"].forEach((field) => {
            const select = employeeForm.elements.namedItem(field);
            const value = field === "contract" ? employee.contract || "" : employee.jobFunction || "";
            if (value && ![...select.options].some((option) => option.value === value)) {
              const legacyOption = new Option(value, value);
              legacyOption.className = "legacy-option";
              select.add(legacyOption);
            }
            select.value = value;
          });
          employeeForm.elements.namedItem("active").value = String(employee.active);
        }
        updateEmployeeComputedFields();
        updateEmployeePhotoPreview();
        employeeDialog.showModal();
        employeeForm.elements.namedItem("name").focus();
      };

      document.querySelector("#add-employee").addEventListener("click", () => openEmployeeForm());
      employeeForm.addEventListener("input", updateEmployeeComputedFields);
      employeeForm.addEventListener("change", updateEmployeeComputedFields);
      employeePhotoInput.addEventListener("change", () => {
        const file = employeePhotoInput.files[0];
        if (file && (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024)) {
          employeePhotoInput.setCustomValidity("Selecione uma imagem de até 10 MB.");
          employeePhotoInput.reportValidity();
          employeePhotoInput.setCustomValidity("");
          employeePhotoInput.value = "";
          return;
        }
        employeePhotoInput.setCustomValidity("");
        updateEmployeePhotoPreview(file);
      });
      document.querySelector("#close-employee-dialog").addEventListener("click", () => employeeDialog.close());
      document.querySelector("#cancel-employee-dialog").addEventListener("click", () => employeeDialog.close());
      employeeDialog.addEventListener("close", () => {
        if (employeePhotoPreviewUrl) URL.revokeObjectURL(employeePhotoPreviewUrl);
        employeePhotoPreviewUrl = null;
      });
      document.querySelectorAll(".employee-tab").forEach((button) => {
        button.addEventListener("click", () => {
          activeEmployeeView = button.dataset.employeeView;
          document.querySelectorAll(".employee-tab").forEach((tab) => {
            const selected = tab === button;
            tab.classList.toggle("active", selected);
            tab.setAttribute("aria-selected", String(selected));
          });
          renderEmployees();
        });
      });
      document.querySelector("#employee-grid").addEventListener("click", (event) => {
        const button = event.target.closest(".employee-edit");
        if (!button) return;
        const employee = employees.find((item) => item.id === button.dataset.employeeId);
        if (employee) openEmployeeForm(employee);
      });
      employeeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!employeeForm.reportValidity()) return;
        const data = Object.fromEntries(new FormData(employeeForm).entries());
        data.active = data.active === "true";
        const employee = { id: editingEmployeeId || crypto.randomUUID(), ...data };
        const photo = employeePhotoInput.files[0];
        const previousEmployees = employees;
        employees = editingEmployeeId
          ? employees.map((item) => item.id === editingEmployeeId ? employee : item)
          : [...employees, employee];
        try {
          saveEmployees();
          if (photo) await saveEmployeePhoto(employee.id, photo);
        } catch (error) {
          employees = previousEmployees;
          try {
            saveEmployees();
          } catch (rollbackError) {
            console.error("Não foi possível restaurar os dados anteriores dos colaboradores.", rollbackError);
          }
          console.error(photo ? "Não foi possível salvar os dados e a foto do colaborador." : "Não foi possível salvar o colaborador.", error);
          document.querySelector("#employee-form-feedback").textContent = "Não foi possível salvar os dados do colaborador neste dispositivo.";
          return;
        }
        renderEmployees();
        employeeDialog.close();
      });
      employeeDialog.addEventListener("click", (event) => {
        if (event.target === employeeDialog) employeeDialog.close();
      });
    }

    document.querySelector("#delete-client").addEventListener("click", () => {
      // Exclui somente depois da confirmacao do usuario.
      const client = clients.find((item) => item.id === editingId);
      if (!client || !confirm(`Excluir o cadastro de ${client.company}?`)) return;
      clients = clients.filter((item) => item.id !== editingId);
      saveClients();
      render();
      closeDialog();
      showToast(isDocumentationArea ? "Registro excluído." : "Cliente excluído.");
    });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
    });

    render();
    documentationFilesReady = loadDocumentationFiles().then(() => {
      render();
      if (isPersonnelArea) renderEmployees();
      if (dialog.open) updateCommercialDocumentFields(editingId);
    }).catch((error) => {
      console.error("Não foi possível carregar os anexos.", error);
      showToast("Não foi possível carregar os anexos neste navegador.");
    });
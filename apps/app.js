// ===============================
// ✅ POLADENT - APP.JS (COMPATIBLE CELULAR)
// TODO EN ESPAÑOL + SALARIO USD
// ✅ SIN optional chaining (?.) NI arrow functions (=>)
// ===============================

// -------------------------------
// 🔹 HELPERS
// -------------------------------
function $(id) { return document.getElementById(id); }

function onClick(id, fn) {
  var el = $(id);
  if (el) el.addEventListener("click", fn);
}

function onChange(id, fn) {
  var el = $(id);
  if (el) el.addEventListener("change", fn);
}

function onInput(id, fn) {
  var el = $(id);
  if (el) el.addEventListener("input", fn);
}

// -------------------------------
// 🔹 ELEMENTOS PRINCIPALES
// -------------------------------
var home = $("home");
var adminLogin = $("adminLogin");
var adminPanel = $("adminPanel");
var employeePanel = $("employeePanel");
var fechaDesde = $("fechaDesde");
var fechaHasta = $("fechaHasta");

// -------------------------------
// 🔹 FORMATO USD
// -------------------------------
var USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatUSD(value) {
  var num = Number(value);
  if (!isFinite(num)) return "USD 0.00";
  return USD.format(num);
}

function tarifaPorHoraUSD(salario, tipoSalario) {
  var s = Number(salario || 0);
  var t = String(tipoSalario || "diario").toLowerCase();

  if (t === "diario") return s / 8;
  if (t === "quincenal") return s / (15 * 8);
  if (t === "mensual") return s / (30 * 8);
  return s / 8;
}

// -------------------------------
// 🔹 NAVEGACIÓN
// -------------------------------
function hideAll() {
  if (home) home.classList.add("hidden");
  if (adminLogin) adminLogin.classList.add("hidden");
  if (adminPanel) adminPanel.classList.add("hidden");
  if (employeePanel) employeePanel.classList.add("hidden");
}

function backHome() {
  hideAll();
  if (home) home.classList.remove("hidden");

  if ($("empNombreGrande")) $("empNombreGrande").innerHTML = "";
  if ($("empPin")) $("empPin").value = "";
  if ($("employeeButtons")) $("employeeButtons").classList.add("hidden");
  if ($("empMsg")) $("empMsg").innerHTML = "";
}

function goAdmin() {
  hideAll();
  if (adminLogin) adminLogin.classList.remove("hidden");
}

function goEmployee() {
  hideAll();
  if (employeePanel) employeePanel.classList.remove("hidden");
}

// -------------------------------
// 🔹 LOGIN ADMIN
// -------------------------------
function loginAdmin() {
  var email = $("adminEmail") ? $("adminEmail").value : "";
  var pass = $("adminPass") ? $("adminPass").value : "";

  if (typeof auth === "undefined") {
    alert("Firebase AUTH no está cargado. Revisa firebase/config.js y el orden de scripts.");
    return;
  }

  auth
    .signInWithEmailAndPassword(email, pass)
    .then(function () {
      hideAll();
      if (adminPanel) adminPanel.classList.remove("hidden");
      setDefaultDate();
      loadEmpleados();
      loadMarcaciones();
      updateChart();
    })
    .catch(function () {
      alert("Error de acceso");
    });
}

function logout() {
  if (typeof auth !== "undefined") auth.signOut();
  backHome();
}

// -------------------------------
// 🔹 EMPLEADOS
// -------------------------------
function agregarEmpleado() {
  if (typeof db === "undefined") {
    alert("Firebase DB no está cargado. Revisa firebase/config.js.");
    return;
  }

  var nombre = $("nombreEmpleado") ? String($("nombreEmpleado").value).trim() : "";
  var pin = $("pinEmpleado") ? String($("pinEmpleado").value).trim() : "";

  if (!nombre || !pin) {
    alert("Completa todos los campos");
    return;
  }

  var id = db.ref("empleados").push().key;

  db.ref("empleados/" + id).set({
    nombre: nombre,
    pin: pin,
    creado: Date.now(),
    salario: 0,
    tipoSalario: "diario"
  });

  if ($("nombreEmpleado")) $("nombreEmpleado").value = "";
  if ($("pinEmpleado")) $("pinEmpleado").value = "";
}

function cargarEmpleados() {
  var cont = $("listaEmpleados");
  if (!cont) return;

  db.ref("empleados").on("value", function (snap) {
    cont.innerHTML = "";

    snap.forEach(function (emp) {
      var data = emp.val() || {};
      var salarioTexto = formatUSD(data.salario) + " (" + String(data.tipoSalario || "diario") + ")";

      cont.innerHTML +=
        '<div class="empleado">' +
          "<strong>" + (data.nombre || "Sin nombre") + "</strong><br>" +
          "PIN: " + (data.pin || "") + "<br>" +
          "Salario: " + salarioTexto +
          '<div class="empActions">' +
            '<button onclick="borrarEmpleado(\'' + emp.key + '\')">Borrar</button>' +
            '<button onclick="asignarSalario(\'' + emp.key + '\')">Asignar salario</button>' +
            '<button onclick="openEditModal(\'' + emp.key + '\')">Editar horario</button>' +
            '<button onclick="generarReciboDetalladoPorId(\'' + emp.key + '\')">Recibo PDF (firma)</button>' +
          "</div>" +
        "</div>";
    });
  });
}

function loadEmpleados() { cargarEmpleados(); }

function borrarEmpleado(id) {
  if (confirm("¿Seguro que deseas borrar este empleado?")) {
    db.ref("empleados/" + id).remove();
    db.ref("marcaciones/" + id).remove();
  }
}

// -------------------------------
// ✅ MODAL SALARIO (SIN PROMPTS)
// -------------------------------
var salarioEmpIdActual = null;

function showSalarioStatus(msg, isError) {
  var box = $("salarioStatus");
  if (!box) return;
  box.style.display = "block";
  box.innerText = msg;
  box.style.borderColor = isError ? "rgba(220,53,69,.35)" : "rgba(13,110,253,.25)";
  box.style.background = isError ? "rgba(220,53,69,.08)" : "rgba(13,110,253,.08)";
}

function hideSalarioStatus() {
  var box = $("salarioStatus");
  if (!box) return;
  box.style.display = "none";
  box.innerText = "";
}

function openSalarioModal(empID) {
  salarioEmpIdActual = empID;

  var modal = $("salarioModal");
  var back = $("salarioModalBackdrop");
  if (!modal || !back) {
    alert("No encuentro el modal salario en el HTML (salarioModal / salarioModalBackdrop).");
    return;
  }

  if ($("salarioValor")) $("salarioValor").value = "";
  if ($("salarioTipo")) $("salarioTipo").value = "diario";
  if ($("salarioEmpNombre")) $("salarioEmpNombre").value = "";
  hideSalarioStatus();

  db.ref("empleados/" + empID).once("value", function (snap) {
    var emp = snap.val();

    if (!emp) {
      showSalarioStatus("⚠️ Empleado no encontrado.", true);
    } else {
      if ($("salarioEmpNombre")) $("salarioEmpNombre").value = emp.nombre || "Sin nombre";
      if ($("salarioValor") && emp.salario != null) $("salarioValor").value = emp.salario;
      if ($("salarioTipo") && emp.tipoSalario) $("salarioTipo").value = emp.tipoSalario;
    }

    modal.classList.remove("hidden");
    back.classList.remove("hidden");
  });
}

function closeSalarioModal() {
  var modal = $("salarioModal");
  var back = $("salarioModalBackdrop");
  if (modal) modal.classList.add("hidden");
  if (back) back.classList.add("hidden");
  hideSalarioStatus();
  salarioEmpIdActual = null;
}

function saveSalarioModal() {
  if (!salarioEmpIdActual) return;

  var salarioRaw = $("salarioValor") ? $("salarioValor").value : "";
  var salario = parseFloat(String(salarioRaw).replace(",", "."));
  var tipo = $("salarioTipo") ? $("salarioTipo").value : "diario";

  if (!isFinite(salario) || salario <= 0) {
    showSalarioStatus("⚠️ Ingresa un salario válido (ej: 200 o 200.50).", true);
    return;
  }

  db.ref("empleados/" + salarioEmpIdActual).update({
    salario: salario,
    tipoSalario: tipo
  }, function (err) {
    if (err) {
      showSalarioStatus("❌ Error al guardar: " + err.message, true);
      return;
    }
    showSalarioStatus("✅ Guardado correctamente.", false);
    loadEmpleados();
    setTimeout(closeSalarioModal, 350);
  });
}

function asignarSalario(empID) { openSalarioModal(empID); }

// Bind botones modal salario
onClick("salarioCancelBtn", closeSalarioModal);
onClick("salarioCloseBtn", closeSalarioModal);
onClick("salarioSaveBtn", saveSalarioModal);
onClick("salarioModalBackdrop", closeSalarioModal);

// -------------------------------
// 🔹 EMPLEADO PIN + BOTONES
// -------------------------------
var empleadoActual = null;
var etapas = ["entrada", "almuerzo_salida", "almuerzo_regreso", "salida"];

function pinInputHandler() {
  var pin = $("empPin") ? String($("empPin").value).trim() : "";
  if (!pin) {
    if ($("employeeButtons")) $("employeeButtons").classList.add("hidden");
    if ($("empNombreGrande")) $("empNombreGrande").innerHTML = "";
    return;
  }

  db.ref("empleados")
    .orderByChild("pin")
    .equalTo(pin)
    .once("value", function (snap) {
      if (!snap.exists()) {
        if ($("employeeButtons")) $("employeeButtons").classList.add("hidden");
        if ($("empNombreGrande")) $("empNombreGrande").innerHTML = "";
        if ($("empMsg")) $("empMsg").innerHTML = "⚠️ PIN no encontrado";
        empleadoActual = null;
        return;
      }

      snap.forEach(function (empSnap) {
        empleadoActual = { id: empSnap.key, nombre: (empSnap.val() || {}).nombre || "Sin nombre" };
        if ($("empNombreGrande")) $("empNombreGrande").innerHTML = empleadoActual.nombre;
        if ($("employeeButtons")) $("employeeButtons").classList.remove("hidden");
        if ($("empMsg")) $("empMsg").innerHTML = "";
      });
    });
}

// -------------------------------
// 🔹 MARCACIÓN
// -------------------------------
function mark(tipo) {
  if (!empleadoActual) return;

  var now = new Date();
  var yyyy = now.getFullYear();
  var mm = now.getMonth() + 1;
  var dd = now.getDate();
  var fecha = yyyy + "-" + (mm < 10 ? "0" + mm : mm) + "-" + (dd < 10 ? "0" + dd : dd);
  var ref = db.ref("marcaciones/" + empleadoActual.id + "/" + fecha);

  ref.once("value", function (snap) {
    var marc = snap.val() || {};
    var lastEtapa = null;
    var lastTime = 0;

    Object.keys(marc).forEach(function (k) {
      var m = marc[k];
      if (m && m.timestamp && m.timestamp > lastTime) {
        lastTime = m.timestamp;
        lastEtapa = m.tipo;
      }
    });

    var lastIndex = lastEtapa ? etapas.indexOf(lastEtapa) : -1;

    if (lastIndex === -1 && tipo !== "entrada") {
      if ($("empMsg")) $("empMsg").innerHTML = "⚠️ Debes iniciar con Entrada";
      return;
    }
    if (lastIndex !== -1 && etapas.indexOf(tipo) !== lastIndex + 1) {
      if ($("empMsg")) $("empMsg").innerHTML = "⚠️ Debes seguir el orden de marcación";
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var lat = pos.coords.latitude;
          var lon = pos.coords.longitude;
          var hora = now.toLocaleTimeString();
          var timestamp = now.getTime();

          ref.child(tipo).set({
            nombre: empleadoActual.nombre,
            tipo: tipo,
            fecha: fecha,
            hora: hora,
            timestamp: timestamp,
            lat: lat,
            lon: lon
          });

          var frase = "";
          if (tipo === "entrada") frase = "¡Buen inicio de jornada!";
          if (tipo === "almuerzo_salida") frase = "Buen provecho 🍽️";
          if (tipo === "almuerzo_regreso") frase = "Bienvenido de vuelta 👋";
          if (tipo === "salida") frase = "¡Buen trabajo!";

          if ($("empMsg")) $("empMsg").innerHTML = empleadoActual.nombre + " | " + frase + " (" + hora + ")";
          mostrarNotificacion(empleadoActual.nombre + " marcó " + tipo + " a las " + hora);

          setTimeout(backHome, 2000);
          loadMarcaciones();
          updateChart();
        },
        function () { alert("No se pudo obtener la ubicación GPS"); }
      );
    } else {
      alert("GPS no disponible");
    }
  });
}

// -------------------------------
// 🔹 ADMIN – RESUMEN MARCACIONES
// -------------------------------
var excelRows = [];
var excelSalarial = [];
var allMarcaciones = {};

function loadMarcaciones() {
  db.ref("marcaciones").on("value", function (snap) {
    allMarcaciones = snap.val() || {};
    renderAdminList($("filterDate") ? $("filterDate").value : "");
    updateChart();
  });
}

function renderAdminList(dateFilter) {
  var cont = $("adminList");
  var notif = $("notificaciones");
  if (!cont || !notif) return;

  cont.innerHTML = "";
  notif.innerHTML = "";
  excelRows = [];
  excelSalarial = [];

  var periodo = $("periodoResumen") ? $("periodoResumen").value : "diario";

  var empIDs = Object.keys(allMarcaciones || {}).sort();

  empIDs.forEach(function (empID) {
    var fechas = allMarcaciones[empID] || {};
    Object.keys(fechas).sort().forEach(function (fecha) {
      var fechaObj = new Date(fecha);
      var dDesde = (fechaDesde && fechaDesde.value) ? new Date(fechaDesde.value) : null;
      var dHasta = (fechaHasta && fechaHasta.value) ? new Date(fechaHasta.value) : null;

      if (dDesde && fechaObj < dDesde) return;
      if (dHasta && fechaObj > dHasta) return;

      if (!dDesde && !dHasta) {
        if (dateFilter && periodo !== "diario" && !fecha.startsWith(dateFilter.substring(0, 7))) return;
        if (periodo === "diario" && dateFilter && fecha !== dateFilter) return;
      }

      var tipos = fechas[fecha] || {};
      Object.keys(tipos).sort().forEach(function (tipo) {
        var data = tipos[tipo] || {};
        var nombre = data.nombre || "Sin nombre";

        cont.innerHTML += "<p><b>" + nombre + "</b> | " + (data.tipo || tipo) + " | " + fecha + " | " + (data.hora || "") + "</p>";

        excelRows.push([nombre, fecha, (data.tipo || tipo), (data.hora || "")]);

        excelSalarial.push({
          empID: empID,
          nombre: nombre,
          fecha: fecha,
          tipo: (data.tipo || tipo),
          timestamp: data.timestamp || null
        });

        notif.innerHTML += '<div class="notif">' + nombre + " marcó " + (data.tipo || tipo) + " a las " + (data.hora || "") + "</div>";
      });
    });
  });

  renderPagos();
}

// -------------------------------
// 🔹 EXPORT EXCEL (MARCACIONES)
// -------------------------------
function exportExcelFiltro() {
  if (typeof XLSX === "undefined") { alert("Falta librería XLSX"); return; }

  var fecha = $("filterDate") ? $("filterDate").value : "";
  var periodo = $("periodoResumen") ? $("periodoResumen").value : "diario";
  var rows = [["Nombre", "Fecha", "Tipo", "Hora"]];

  for (var i = 0; i < excelRows.length; i++) {
    var m = excelRows[i];
    var mFecha = m[1];

    if (periodo === "diario" && fecha && mFecha !== fecha) continue;
    if (periodo === "quincenal" && fecha && !mFecha.startsWith(fecha.substring(0, 7))) continue;
    if (periodo === "mensual" && fecha && !mFecha.startsWith(fecha.substring(0, 4) + "-" + fecha.substring(5, 7))) continue;

    rows.push(m);
  }

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Resumen");
  XLSX.writeFile(wb, "Poladent_Marcaciones_Filtro.xlsx");
}

// -------------------------------
// 🔹 EXPORT EXCEL (SALARIO)
// -------------------------------
function estaEnRango(fecha, desde, hasta) {
  var f = new Date(fecha);
  var d = desde ? new Date(desde) : null;
  var h = hasta ? new Date(hasta) : null;
  if (d && f < d) return false;
  if (h && f > h) return false;
  return true;
}

function exportExcelSalarialFiltro() {
  if (typeof XLSX === "undefined") { alert("Falta librería XLSX"); return; }

  var desde = fechaDesde ? fechaDesde.value : "";
  var hasta = fechaHasta ? fechaHasta.value : "";

  var resumen = {};
  for (var i = 0; i < excelSalarial.length; i++) {
    var m = excelSalarial[i];
    if (!estaEnRango(m.fecha, desde, hasta)) continue;

    if (!resumen[m.empID]) resumen[m.empID] = { nombre: m.nombre, dias: {} };
    if (!resumen[m.empID].dias[m.fecha]) {
      resumen[m.empID].dias[m.fecha] = { entrada: null, salida: null, almuerzo_salida: null, almuerzo_regreso: null };
    }
    resumen[m.empID].dias[m.fecha][m.tipo] = m.timestamp;
  }

  var wsData = [["Empleado", "Fecha", "Horas trabajadas", "Horas NO trabajadas", "Banco de horas", "Pago del día (USD)"]];
  var empIDs = Object.keys(resumen);

  var promesas = empIDs.map(function (empID) {
    return db.ref("empleados/" + empID).once("value").then(function (snap) {
      var empData = snap.val() || {};
      var empNombre = empData.nombre || resumen[empID].nombre || "Sin nombre";

      var salario = Number(empData.salario || 0);
      var tipoSalario = empData.tipoSalario || "diario";
      var tarifaHora = tarifaPorHoraUSD(salario, tipoSalario);

      var bancoTotal = 0;
      var totalPagar = 0;

      var diasObj = resumen[empID].dias;
      Object.keys(diasObj).sort().forEach(function (dia) {
        var d = diasObj[dia];
        if (!d.entrada || !d.salida) return;

        var almuerzo = 0;
        if (d.almuerzo_salida && d.almuerzo_regreso) {
          almuerzo = (d.almuerzo_regreso - d.almuerzo_salida) / 3600000;
        }

        var horas = (d.salida - d.entrada) / 3600000 - almuerzo;
        if (!isFinite(horas) || horas < 0) horas = 0;

        var normales = Math.min(8, horas);
        var extra = Math.max(0, horas - 8);
        var noTrab = Math.max(0, 8 - normales);

        bancoTotal += extra;

        var pagoDia = normales * tarifaHora;
        totalPagar += pagoDia;

        wsData.push([empNombre, dia, normales.toFixed(2), noTrab.toFixed(2), bancoTotal.toFixed(2), pagoDia.toFixed(2)]);
      });

      wsData.push([empNombre, "TOTAL", "", "", bancoTotal.toFixed(2), totalPagar.toFixed(2)]);
    });
  });

  Promise.all(promesas).then(function () {
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), "Salario");
    XLSX.writeFile(wb, "Poladent_Salario_Filtro.xlsx");
  });
}

// -------------------------------
// 🔹 RESUMEN DE PAGOS (PRO) + PDF
// -------------------------------
function renderPagos() {
  var cont = $("resumenPagos");
  if (!cont) return;

  cont.innerHTML = "<h4>💰 Resumen de pagos y banco de horas (USD)</h4>";

  var desde = fechaDesde ? fechaDesde.value : "";
  var hasta = fechaHasta ? fechaHasta.value : "";

  var resumen = {};
  for (var i = 0; i < excelSalarial.length; i++) {
    var m = excelSalarial[i];
    if (!estaEnRango(m.fecha, desde, hasta)) continue;

    if (!resumen[m.empID]) resumen[m.empID] = { nombre: m.nombre, dias: {} };
    if (!resumen[m.empID].dias[m.fecha]) {
      resumen[m.empID].dias[m.fecha] = { entrada: null, salida: null, almuerzo_salida: null, almuerzo_regreso: null };
    }
    resumen[m.empID].dias[m.fecha][m.tipo] = m.timestamp;
  }

  var empIDs = Object.keys(resumen);
  if (empIDs.length === 0) {
    cont.innerHTML += '<p style="opacity:.8;">No hay datos en el rango seleccionado.</p>';
    return;
  }

  empIDs.forEach(function (empID) {
    db.ref("empleados/" + empID).once("value").then(function (snap) {
      var emp = snap.val() || {};
      var nombre = emp.nombre || resumen[empID].nombre || "Sin nombre";

      var salario = Number(emp.salario || 0);
      var tipoSalario = emp.tipoSalario || "diario";
      var tarifaHora = tarifaPorHoraUSD(salario, tipoSalario);

      var horasTrab = 0;
      var horasExtra = 0;
      var horasNoTrab = 0;
      var totalPagar = 0;
      var totalDesc = 0;

      var diasObj = resumen[empID].dias;
      var diasOrden = Object.keys(diasObj).sort();

      var detalle = [];

      diasOrden.forEach(function (dia) {
        var d = diasObj[dia];
        if (!d.entrada || !d.salida) return;

        var almuerzo = 0;
        if (d.almuerzo_salida && d.almuerzo_regreso) {
          almuerzo = (d.almuerzo_regreso - d.almuerzo_salida) / 3600000;
        }

        var horas = (d.salida - d.entrada) / 3600000 - almuerzo;
        if (!isFinite(horas) || horas < 0) horas = 0;

        var normales = Math.min(8, horas);
        var extra = Math.max(0, horas - 8);
        var noTrab = Math.max(0, 8 - normales);

        var pagoDia = normales * tarifaHora;
        var descDia = noTrab * tarifaHora;

        horasTrab += normales;
        horasExtra += extra;
        horasNoTrab += noTrab;
        totalPagar += pagoDia;
        totalDesc += descDia;

        detalle.push({ dia: dia, normales: normales, noTrab: noTrab, pagoDia: pagoDia });
      });

      var html = ''
        + '<div style="background:#fff;border-radius:10px;padding:10px;margin:10px 0;box-shadow:0 2px 10px rgba(0,0,0,.06);">'
        + '<p style="margin:0 0 6px 0;"><b>' + nombre + '</b></p>'
        + '<p style="margin:0;opacity:.85;">Periodo: <b>' + (desde || "—") + '</b> a <b>' + (hasta || "—") + '</b></p>'
        + '<p style="margin:6px 0 0 0;">Salario: <b>' + formatUSD(salario) + '</b> (' + tipoSalario + ') | Tarifa/hora: <b>' + formatUSD(tarifaHora) + '</b></p>'
        + '<p style="margin:6px 0 0 0;">Horas trabajadas: <b>' + horasTrab.toFixed(2) + '</b> | Horas NO trabajadas: <b>' + horasNoTrab.toFixed(2) + '</b> | Banco (extra): <b>' + horasExtra.toFixed(2) + '</b></p>'
        + '<p style="margin:6px 0 0 0;">Descuento total: <b>' + formatUSD(totalDesc) + '</b> | <span style="font-size:16px;">Total a pagar: <b>' + formatUSD(totalPagar) + '</b></span></p>'
        + '<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(0,0,0,.08);">'
        + '<p style="margin:0 0 6px 0;font-weight:600;">Detalle por día</p>';

      if (detalle.length === 0) {
        html += '<p style="margin:0;opacity:.8;">No hay días completos (entrada y salida) en el rango.</p>';
      } else {
        detalle.forEach(function (x) {
          html += '<p style="margin:3px 0;">📅 ' + x.dia + ' — Horas: <b>' + x.normales.toFixed(2)
            + '</b>, Descuento: <b>' + x.noTrab.toFixed(2)
            + '</b>, Pago día: <b>' + formatUSD(x.pagoDia) + '</b></p>';
        });
      }

      html += ''
        + '</div>'
        + '<div style="margin-top:10px;">'
        + '<button onclick="generarReciboDetalladoPorId(\'' + empID + '\')">🧾 Generar recibo PDF (firma)</button>'
        + '</div>'
        + '</div>';

      cont.innerHTML += html;
    });
  });
}

// -------------------------------
// 🧾 PDF DETALLADO (FIRMA) - POR ID
// -------------------------------
function generarReciboDetalladoPorId(empID) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("Falta librería jsPDF");
    return;
  }

  var desde = fechaDesde ? fechaDesde.value : "";
  var hasta = fechaHasta ? fechaHasta.value : "";

  db.ref("empleados/" + empID).once("value").then(function (empSnap) {
    var emp = empSnap.val();
    if (!emp) { alert("Empleado no encontrado"); return; }

    return db.ref("marcaciones/" + empID).once("value").then(function (marcSnap) {
      var marc = marcSnap.val() || {};

      var salario = Number(emp.salario || 0);
      var tipoSalario = emp.tipoSalario || "diario";
      var tarifaHora = tarifaPorHoraUSD(salario, tipoSalario);

      var dias = Object.keys(marc).sort().filter(function (f) {
        if (desde && new Date(f) < new Date(desde)) return false;
        if (hasta && new Date(f) > new Date(hasta)) return false;
        return true;
      });

      var horasTrab = 0, horasExtra = 0, horasNoTrab = 0, totalPagar = 0, totalDesc = 0;
      var detalle = [];

      dias.forEach(function (dia) {
        var tipos = marc[dia] || {};
        var entrada = tipos.entrada && tipos.entrada.timestamp ? tipos.entrada.timestamp : null;
        var salida = tipos.salida && tipos.salida.timestamp ? tipos.salida.timestamp : null;
        if (!entrada || !salida) return;

        var almuerzo = 0;
        var aS = tipos.almuerzo_salida && tipos.almuerzo_salida.timestamp ? tipos.almuerzo_salida.timestamp : null;
        var aR = tipos.almuerzo_regreso && tipos.almuerzo_regreso.timestamp ? tipos.almuerzo_regreso.timestamp : null;
        if (aS && aR) almuerzo = (aR - aS) / 3600000;

        var horas = (salida - entrada) / 3600000 - almuerzo;
        if (!isFinite(horas) || horas < 0) horas = 0;

        var normales = Math.min(8, horas);
        var extra = Math.max(0, horas - 8);
        var noTrab = Math.max(0, 8 - normales);

        var pagoDia = normales * tarifaHora;
        var descDia = noTrab * tarifaHora;

        horasTrab += normales;
        horasExtra += extra;
        horasNoTrab += noTrab;
        totalPagar += pagoDia;
        totalDesc += descDia;

        detalle.push({ dia: dia, normales: normales, noTrab: noTrab, pagoDia: pagoDia });
      });

      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF();
      var y = 18;

      doc.setFontSize(16);
      doc.text("RECIBO DE PAGO (USD)", 14, y); y += 10;

      doc.setFontSize(11);
      doc.text("Empleado: " + (emp.nombre || "Sin nombre"), 14, y); y += 6;
      doc.text("Periodo: " + (desde || "—") + " a " + (hasta || "—"), 14, y); y += 6;
      doc.text("Tipo de salario: " + tipoSalario, 14, y); y += 6;
      doc.text("Salario: " + formatUSD(salario) + " | Tarifa/hora: " + formatUSD(tarifaHora), 14, y); y += 8;

      doc.setFontSize(12);
      doc.text("Horas trabajadas: " + horasTrab.toFixed(2), 14, y); y += 6;
      doc.text("Horas NO trabajadas (descuento): " + horasNoTrab.toFixed(2), 14, y); y += 6;
      doc.text("Banco de horas (extra): " + horasExtra.toFixed(2), 14, y); y += 6;
      doc.text("Descuento total: " + formatUSD(totalDesc), 14, y); y += 6;

      doc.setFontSize(14);
      doc.text("TOTAL A PAGAR: " + formatUSD(totalPagar), 14, y); y += 10;

      doc.setFontSize(12);
      doc.text("Detalle por día:", 14, y); y += 8;

      doc.setFontSize(10);
      doc.text("Fecha", 14, y);
      doc.text("Horas", 55, y);
      doc.text("Desc.", 85, y);
      doc.text("Pago día", 115, y);
      y += 4;
      doc.line(14, y, 196, y);
      y += 6;

      detalle.forEach(function (d) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(String(d.dia), 14, y);
        doc.text(d.normales.toFixed(2), 55, y);
        doc.text(d.noTrab.toFixed(2), 85, y);
        doc.text(formatUSD(d.pagoDia), 115, y);
        y += 6;
      });

      if (y > 250) { doc.addPage(); y = 20; }
      y += 12;

      doc.setFontSize(11);
      doc.text("Firma del empleado: ________________________________", 14, y); y += 10;
      doc.text("Firma del encargado: _______________________________", 14, y); y += 10;
      doc.text("Fecha de firma: ____/____/______", 14, y);

      doc.save("Recibo_" + String(emp.nombre || "Empleado").replace(/\s+/g, "_") + ".pdf");
    });
  });
}

// -------------------------------
// 🔹 GRÁFICO HORAS (si Chart.js existe)
// -------------------------------
function renderChart() {
  if (typeof Chart === "undefined") return;
  var canvas = $("horasChart");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var resumenHoras = {};

  for (var empID in allMarcaciones) {
    var fechas = allMarcaciones[empID] || {};
    for (var fecha in fechas) {
      var tipos = fechas[fecha] || {};
      var entrada = null, salida = null;

      for (var k in tipos) {
        var m = tipos[k];
        if (m && m.tipo === "entrada") entrada = m.timestamp;
        if (m && m.tipo === "salida") salida = m.timestamp;
      }
      if (!entrada || !salida) continue;

      var nombre = (Object.values(tipos)[0] && Object.values(tipos)[0].nombre) ? Object.values(tipos)[0].nombre : "Sin nombre";
      if (!resumenHoras[nombre]) resumenHoras[nombre] = 0;
      resumenHoras[nombre] += (salida - entrada) / 3600000;
    }
  }

  var labels = Object.keys(resumenHoras);
  var data = labels.map(function (k) { return resumenHoras[k]; });

  if (window.horasChartInstance) window.horasChartInstance.destroy();
  window.horasChartInstance = new Chart(ctx, {
    type: "bar",
    data: { labels: labels, datasets: [{ label: "Horas trabajadas", data: data }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

function updateChart() { renderChart(); }

// -------------------------------
// 🔹 FECHA DEFAULT
// -------------------------------
function setDefaultDate() {
  var today = new Date();
  var month = String(today.getMonth() + 1).padStart(2, "0");
  var day = String(today.getDate()).padStart(2, "0");
  var yyyy = today.getFullYear();
  if ($("filterDate")) $("filterDate").value = yyyy + "-" + month + "-" + day;
}

// -------------------------------
// 🔹 LISTENERS FILTROS
// -------------------------------
onChange("filterDate", function () {
  renderAdminList($("filterDate") ? $("filterDate").value : "");
  updateChart();
});
onChange("periodoResumen", function () {
  renderAdminList($("filterDate") ? $("filterDate").value : "");
  updateChart();
});
onChange("fechaDesde", function () {
  renderAdminList($("filterDate") ? $("filterDate").value : "");
  updateChart();
});
onChange("fechaHasta", function () {
  renderAdminList($("filterDate") ? $("filterDate").value : "");
  updateChart();
});

// -------------------------------
// ✅ MODAL EDITAR HORARIO (si ya lo tenías funcionando, lo puedes pegar aquí después)
// -------------------------------
// (Lo dejamos fuera para no alargar más. Si quieres, te lo integro también.)

// -------------------------------
// 🔹 BOTONES PRINCIPALES (HOME)
// -------------------------------
onClick("btnAdmin", goAdmin);
onClick("btnEmployee", goEmployee);
onClick("backHomeBtn1", backHome);
onClick("backHomeBtn2", backHome);
onClick("loginBtn", loginAdmin);
onClick("guardarEmpleadoBtn", agregarEmpleado);
onClick("exportMarcBtn", exportExcelFiltro);
onClick("exportSalarioBtn", exportExcelSalarialFiltro);
onClick("logoutBtn", logout);

// Botones empleado
onClick("entradaBtn", function () { mark("entrada"); });
onClick("almuerzoSalidaBtn", function () { mark("almuerzo_salida"); });
onClick("almuerzoRegresoBtn", function () { mark("almuerzo_regreso"); });
onClick("salidaBtn", function () { mark("salida"); });

onInput("empPin", pinInputHandler);

// -------------------------------
// 🔹 INICIO
// -------------------------------
backHome();
setDefaultDate();
if ($("periodoResumen")) $("periodoResumen").value = "diario";

// ✅ Solo intenta cargar si Firebase está listo
if (typeof db !== "undefined") {
  loadEmpleados();
  loadMarcaciones();
}
updateChart();
